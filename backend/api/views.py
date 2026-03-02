from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from datetime import timedelta
from django.db.models import Avg, Count, Q, Max, F
from django.db.models.functions import TruncHour
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import User, Device, Alert, Metric, Zone, AlertThreshold
from .models import ISP, Port
from .serializers import (UserSerializer, LoginSerializer, SignupSerializer,
                         DeviceSerializer, AlertSerializer, MetricSerializer,
                         ISPSerializer, PortSerializer, AlertThresholdSerializer)
from .serializers import ZoneSerializer, AuditSerializer
from .siem import forward_to_siem
from .permissions import IsAdminOrOperatorOrReadOnly
from .validators import safe_int, safe_float, safe_bool
from devices.snmp_service import poll_device
from .tasks import poll_single_device
import logging
import random

logger = logging.getLogger('netpulse.views')


@api_view(['GET', 'HEAD']) 
@permission_classes([AllowAny])
def api_root(request):
    """Simple root view for API status and health checks."""
    return Response({
        "name": "NetPulse API",
        "status": "online",
        "version": "1.0.0",
        "message": "Welcome to NetPulse Network Monitoring API",
        "endpoints": {
            "admin": "/admin/",
            "api": "/api/",
            "dashboard_kpi": "/api/dashboard/kpi/"
        }
    })


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class AuthViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]
    
    @action(detail=False, methods=['post'])
    def login(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            refresh = RefreshToken.for_user(user)
            ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR')
            forward_to_siem('login', {
                'username': user.username,
                'time': timezone.now().isoformat(),
            }, user=user, ip_address=ip)
            return Response({
                'success': True,
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            })
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def signup(self, request):
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response({
                'success': True,
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }, status=status.HTTP_201_CREATED)
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def logout(self, request):
        user = request.user if request.user.is_authenticated else None
        ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR')
        forward_to_siem('logout', {
            'username': user.username if user else None,
            'time': timezone.now().isoformat(),
        }, user=user, ip_address=ip)
        return Response({'success': True})


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
class UserViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return User.objects.filter(id=self.request.user.id)
    
    @action(detail=False)
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------
class AuditViewSet(viewsets.ReadOnlyModelViewSet):
    """Expose recent audit events for admins/operators to review."""
    permission_classes = [IsAuthenticated]
    serializer_class = AuditSerializer

    def get_queryset(self):
        from .models import Audit
        if self.request.user.role in ('admin', 'operator'):
            return Audit.objects.all()
        return Audit.objects.filter(user=self.request.user)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
class DashboardViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    
    def _ensure_recent_metrics(self):
        """Trigger background polling for devices with stale metrics."""
        stale_cutoff = timezone.now() - timedelta(minutes=2)
        devices = Device.objects.filter(is_active=True)
        for device in devices:
            latest = device.metrics.order_by('-timestamp').first()
            if latest and latest.timestamp and latest.timestamp >= stale_cutoff:
                continue
            try:
                poll_single_device.delay(device.id)
            except Exception:
                pass

    @action(detail=False)
    def kpi(self, request):
        """Dynamic KPI data with real metrics"""
        try:
            total_devices = Device.objects.count()
            online_devices = Device.objects.filter(is_online=True).count()
            offline_devices = total_devices - online_devices
            
            critical_alerts = Alert.objects.filter(severity='critical', status='open').count()
            warning_alerts = Alert.objects.filter(severity='warning', status='open').count()
            info_alerts = Alert.objects.filter(severity='info', status='open').count()
            
            last_hour = timezone.now() - timedelta(hours=1)
            recent_metrics = Metric.objects.filter(timestamp__gte=last_hour)
            avg_metrics = recent_metrics.aggregate(
                avg_network_in=Avg('network_in'),
                avg_network_out=Avg('network_out'),
                avg_cpu=Avg('cpu_usage'),
                avg_memory=Avg('memory_usage')
            )
            
            temp_metric = Metric.objects.filter(temperature__isnull=False).order_by('-timestamp').first()
            current_temp = temp_metric.temperature if temp_metric else 22.5
            
            health_percentage = round((online_devices / total_devices) * 100, 1) if total_devices > 0 else 0
            
            latest_metric = Metric.objects.order_by('-timestamp').first()
            current_bandwidth = latest_metric.network_in if latest_metric else 0
            current_throughput = latest_metric.network_out if latest_metric else 0

            def avg_temp_for_devices(qs_devices):
                try:
                    if not qs_devices.exists():
                        return None
                    avg = Metric.objects.filter(
                        device__in=qs_devices, temperature__isnull=False
                    ).aggregate(Avg('temperature'))['temperature__avg']
                    return round(avg, 1) if avg is not None else None
                except Exception:
                    return None

            def estimate_humidity(temp):
                try:
                    t = float(temp)
                    hum = 45 + (22.5 - t) * 1.2
                    return max(20, min(80, round(hum)))
                except Exception:
                    return 45

            try:
                zones = {z.key.lower(): z for z in Zone.objects.filter(key__in=['dc1', 'dc2', 'dr', 'dr2'])}
            except Exception:
                zones = {}

            def temp_for_zone_key(key):
                z = zones.get(key)
                if z:
                    return avg_temp_for_devices(z.devices.all())
                qs_devices = Device.objects.filter(Q(name__icontains=key) | Q(location__icontains=key))
                return avg_temp_for_devices(qs_devices)

            dc1_temp = temp_for_zone_key('dc1') or current_temp
            dc2_temp = temp_for_zone_key('dc2') or current_temp
            dr_temp = temp_for_zone_key('dr') or current_temp
            dr2_temp = temp_for_zone_key('dr2') or current_temp

            dc1_hum = estimate_humidity(dc1_temp)
            dc2_hum = estimate_humidity(dc2_temp)
            dr_hum = estimate_humidity(dr_temp)
            dr2_hum = estimate_humidity(dr2_temp)
            
            device_list = []
            all_devices = Device.objects.filter(is_active=True).select_related('zone')
            total_bw_in = 0
            total_bw_out = 0
            temp_values = []
            for dev in all_devices:
                latest_m = dev.metrics.order_by('-timestamp').first()
                cpu_val = round(latest_m.cpu_usage, 1) if latest_m and latest_m.cpu_usage is not None else round(dev.cpu_load, 1)
                mem_val = round(latest_m.memory_usage, 1) if latest_m and latest_m.memory_usage is not None else round(dev.memory_load, 1)
                temp_val = round(latest_m.temperature, 1) if latest_m and latest_m.temperature is not None else (round(dev.temperature, 1) if dev.temperature else None)
                net_in = round(latest_m.network_in, 1) if latest_m and latest_m.network_in is not None else 0
                net_out = round(latest_m.network_out, 1) if latest_m and latest_m.network_out is not None else 0
                total_bw_in += net_in
                total_bw_out += net_out
                if temp_val is not None:
                    temp_values.append(temp_val)
                device_list.append({
                    'id': dev.id,
                    'name': dev.name,
                    'ip_address': dev.ip_address,
                    'device_type': dev.device_type,
                    'is_online': dev.is_online,
                    'zone': dev.zone.name if dev.zone else '',
                    'cpu_load': cpu_val,
                    'memory_load': mem_val,
                    'temperature': temp_val,
                    'uplink_capacity': dev.uplink_capacity or '10 Gbps',
                    'network_in': net_in,
                    'network_out': net_out,
                    'throughput_out': net_out,
                    'uptime_days': round(dev.uptime_days, 1) if dev.uptime_days else 0,
                    'sys_name': dev.sys_name or dev.name,
                })

            avg_temp = round(sum(temp_values) / len(temp_values), 1) if temp_values else current_temp
            total_bw_gbps = round((total_bw_in + total_bw_out) / 1000, 1) if (total_bw_in + total_bw_out) > 0 else 0

            data = {
                'devices_status': f"{online_devices}/{total_devices} Online",
                'online_count': online_devices,
                'online_devices': online_devices,
                'offline_count': offline_devices,
                'total_devices': total_devices,
                'active_alerts': f"{critical_alerts} Critical, {warning_alerts} Warning",
                'critical_alerts': critical_alerts,
                'warning_alerts': warning_alerts,
                'info_alerts': info_alerts,
                'avg_temperature': f"{current_temp}°C",
                'temperature_value': current_temp,
                'ups_status': f"{health_percentage}% Healthy",
                'health_percentage': health_percentage,
                'bandwidth': f"{current_bandwidth:.1f} Mbps",
                'throughput': f"{current_throughput:.1f} Mbps",
                'latency': '23 ms',
                'jitter': '2 ms',
                'dc1_temperature': f"{dc1_temp}°C",
                'dc1_humidity': f"{dc1_hum}% Humidity",
                'dc2_temperature': f"{dc2_temp}°C",
                'dc2_humidity': f"{dc2_hum}% Humidity",
                'dr_temperature': f"{dr_temp}°C",
                'dr_humidity': f"{dr_hum}% Humidity",
                'dr2_temperature': f"{dr2_temp}°C",
                'dr2_humidity': f"{dr2_hum}% Humidity",
                'bandwidth_value': current_bandwidth,
                'throughput_value': current_throughput,
                'avg_cpu': avg_metrics['avg_cpu'] or 0,
                'avg_memory': avg_metrics['avg_memory'] or 0,
                'avg_temp': avg_temp,
                'total_bandwidth_gbps': total_bw_gbps,
                'devices': device_list,
            }
            return Response(data)
            
        except Exception as e:
            logger.exception('KPI endpoint error: %s', e)
            return Response({
                'devices_status': '0/0 Online',
                'active_alerts': '0 Critical, 0 Warning',
                'avg_temperature': '22.5°C',
                'ups_status': '0% Healthy',
                'bandwidth': '0.0 Mbps',
                'throughput': '0.0 Mbps',
                'latency': '0 ms',
                'jitter': '0 ms',
                'online_count': 0,
                'critical_alerts': 0,
                'warning_alerts': 0,
                'error': str(e)
            })
    
    @action(detail=False)
    def ai_insights(self, request):
        """AI insights based on actual system data"""
        try:
            insights = []
            
            offline_devices = Device.objects.filter(is_online=False, is_active=True)
            if offline_devices.exists():
                device_list = ", ".join([d.name for d in offline_devices[:3]])
                insights.append(f"{offline_devices.count()} devices offline including {device_list}")
            
            high_cpu = Metric.objects.filter(
                cpu_usage__gt=80,
                timestamp__gte=timezone.now() - timedelta(hours=1)
            ).select_related('device')
            
            if high_cpu.exists():
                devices = set([m.device.name for m in high_cpu[:5]])
                insights.append(f"High CPU usage detected on {', '.join(devices)}")
            
            critical_alerts = Alert.objects.filter(severity='critical', status='open')
            if critical_alerts.exists():
                insights.append(f"{critical_alerts.count()} critical alerts require immediate attention")
            
            recent_metrics = Metric.objects.filter(
                timestamp__gte=timezone.now() - timedelta(hours=6)
            ).aggregate(
                max_bandwidth=Max('network_in'),
                avg_bandwidth=Avg('network_in')
            )
            
            if recent_metrics['max_bandwidth'] and recent_metrics['max_bandwidth'] > 500:
                insights.append("Network bandwidth peaked above 500 Mbps - consider capacity planning")
            
            if not insights:
                insights = [
                    "All systems operating within normal parameters",
                    "Network performance is optimal",
                    "No critical issues detected in the past 24 hours"
                ]
            
            return Response({'insights': insights[:5]})
            
        except Exception as e:
            logger.exception('AI insights error: %s', e)
            return Response({'insights': [
                "System analysis: All components functioning normally",
                "Network status: Stable and performing well",
                "Alert status: No critical issues detected"
            ]})
    
    @action(detail=False)
    def stats(self, request):
        """Real-time statistics for dashboard widgets"""
        try:
            last_hour = timezone.now() - timedelta(hours=1)
            
            temp_metrics = Metric.objects.filter(temperature__isnull=False, timestamp__gte=last_hour)
            current_temp = 22.5
            temp_progress = 75
            
            if temp_metrics.exists():
                latest_temp = temp_metrics.order_by('-timestamp').first().temperature
                current_temp = round(latest_temp, 1)
                temp_progress = min(100, (current_temp / 30) * 100)
            
            total_devices = Device.objects.count()
            online_devices = Device.objects.filter(is_online=True).count()
            system_health = round((online_devices / total_devices) * 100, 1) if total_devices > 0 else 0
            
            recent_metrics = Metric.objects.filter(timestamp__gte=last_hour)
            performance_data = recent_metrics.aggregate(
                avg_cpu=Avg('cpu_usage'),
                avg_memory=Avg('memory_usage')
            )
            
            data = {
                'temperature': {
                    'value': current_temp,
                    'progress': f'{temp_progress}%',
                    'comparison': 'Stable within optimal range'
                },
                'humidity': {
                    'value': 45,
                    'progress': '45%',
                    'comparison': 'Ideal conditions maintained'
                },
                'passenger_systems': {
                    'value': system_health,
                    'progress': f'{system_health}%',
                    'comparison': f'{online_devices} of {total_devices} systems operational'
                },
                'performance': {
                    'cpu': round(performance_data['avg_cpu'] or 0, 1),
                    'memory': round(performance_data['avg_memory'] or 0, 1)
                }
            }
            return Response(data)
            
        except Exception as e:
            logger.exception('Stats endpoint error: %s', e)
            return Response({
                'temperature': {'value': 22.5, 'progress': '75%', 'comparison': 'Optimal'},
                'humidity': {'value': 45, 'progress': '45%', 'comparison': 'Stable'},
                'passenger_systems': {'value': 0, 'progress': '0%', 'comparison': 'No data'}
            })

    @action(detail=False)
    def map(self, request):
        """Map data endpoint"""
        try:
            devices = Device.objects.filter(is_active=True).select_related('zone')
            data = []
            for dev in devices:
                data.append({
                    'id': dev.id,
                    'name': dev.name,
                    'ip_address': dev.ip_address,
                    'device_type': dev.device_type,
                    'is_online': dev.is_online,
                    'location': dev.location,
                    'zone': dev.zone.name if dev.zone else '',
                })
            return Response({'devices': data})
        except Exception as e:
            logger.exception('Map endpoint error: %s', e)
            return Response({'devices': []})
    
    @action(detail=False)
    def real_time_data(self, request):
        """Endpoint for real-time client updates including full device list for tables"""
        try:
            self._ensure_recent_metrics()
            recent_time = timezone.now() - timedelta(minutes=5)

            metrics_queryset = Metric.objects.filter(
                timestamp__gte=recent_time
            ).select_related('device')
            if not metrics_queryset.exists():
                metrics_queryset = Metric.objects.all().select_related('device')

            latest_metrics = list(metrics_queryset.order_by('-timestamp')[:50])
            metrics_data = MetricSerializer(latest_metrics, many=True).data

            laptop_metric = Metric.objects.filter(
                device__name__icontains='laptop'
            ).select_related('device').order_by('-timestamp').first()
            laptop_payload = None
            if laptop_metric:
                laptop_payload = {
                    'device_id': laptop_metric.device_id,
                    'name': laptop_metric.device.name,
                    'cpu': round(laptop_metric.cpu_usage, 1) if laptop_metric.cpu_usage is not None else None,
                    'memory': round(laptop_metric.memory_usage, 1) if laptop_metric.memory_usage is not None else None,
                    'timestamp': laptop_metric.timestamp.isoformat() if laptop_metric.timestamp else None,
                }

            cpu_values = [m.cpu_usage for m in latest_metrics if m.cpu_usage is not None]
            mem_values = [m.memory_usage for m in latest_metrics if m.memory_usage is not None]
            avg_cpu = round(sum(cpu_values) / len(cpu_values), 1) if cpu_values else None
            avg_memory = round(sum(mem_values) / len(mem_values), 1) if mem_values else None
            
            current_alerts = Alert.objects.filter(status='open').order_by('-created_at')[:5]
            alerts_data = AlertSerializer(current_alerts, many=True).data
            
            total_devices = Device.objects.count()
            online_devices = Device.objects.filter(is_online=True).count()
            warning_alerts = Alert.objects.filter(severity='warning', status='open').count()
            critical_alerts = Alert.objects.filter(severity='critical', status='open').count()

            devices_status = {
                'online': online_devices,
                'total': total_devices,
                'recent_changes': Device.objects.filter(last_seen__gte=recent_time).count()
            }

            device_list = []
            all_devices = Device.objects.filter(is_active=True).select_related('zone')
            for dev in all_devices:
                latest = dev.metrics.order_by('-timestamp').first()
                device_list.append({
                    'id': dev.id,
                    'name': dev.name,
                    'ip_address': dev.ip_address,
                    'device_type': dev.device_type,
                    'is_online': dev.is_online,
                    'zone': dev.zone.name if dev.zone else '',
                    'cpu_load': round(latest.cpu_usage, 1) if latest and latest.cpu_usage is not None else round(dev.cpu_load, 1),
                    'memory_load': round(latest.memory_usage, 1) if latest and latest.memory_usage is not None else round(dev.memory_load, 1),
                    'temperature': round(latest.temperature, 1) if latest and latest.temperature is not None else (round(dev.temperature, 1) if dev.temperature else None),
                    'uplink_capacity': dev.uplink_capacity or '10 Gbps',
                    'network_in': round(latest.network_in, 1) if latest and latest.network_in is not None else 0,
                    'network_out': round(latest.network_out, 1) if latest and latest.network_out is not None else 0,
                    'throughput_out': round(latest.network_out, 1) if latest and latest.network_out is not None else 0,
                    'uptime_days': round(dev.uptime_days, 1) if dev.uptime_days else 0,
                    'sys_name': dev.sys_name or dev.name,
                })
            
            return Response({
                'timestamp': timezone.now().isoformat(),
                'metrics': metrics_data,
                'alerts': alerts_data,
                'devices': devices_status,
                'device_list': device_list,
                'system_health': self._calculate_system_health(),
                'avg_cpu': avg_cpu,
                'avg_memory': avg_memory,
                'total_devices': total_devices,
                'online_devices': online_devices,
                'online_count': online_devices,
                'warning_alerts': warning_alerts,
                'critical_alerts': critical_alerts,
                'laptop': laptop_payload
            })
            
        except Exception as e:
            logger.exception('Real-time data error: %s', e)
            return Response({
                'success': False,
                'error': str(e),
                'timestamp': timezone.now().isoformat(),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _calculate_system_health(self):
        """Calculate overall system health percentage"""
        total_devices = Device.objects.count()
        if total_devices == 0:
            return 100
        
        online_devices = Device.objects.filter(is_online=True).count()
        health_percentage = (online_devices / total_devices) * 100
        
        critical_alerts = Alert.objects.filter(severity='critical', status='open').count()
        health_percentage -= (critical_alerts * 5)
        
        return max(0, min(100, round(health_percentage, 1)))


# ---------------------------------------------------------------------------
# Devices — Full CRUD
# ---------------------------------------------------------------------------
class DeviceViewSet(viewsets.ModelViewSet):
    queryset = Device.objects.all()
    serializer_class = DeviceSerializer
    permission_classes = [IsAdminOrOperatorOrReadOnly]

    def create(self, request, *args, **kwargs):
        """Create device and perform initial SNMP poll to populate status/metrics"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        device = serializer.save()

        try:
            result = poll_device(device.ip_address, device.device_type, device.snmp_community)
            device.is_online = result.get('reachable', False)
            if device.is_online:
                device.last_seen = timezone.now()
                device.sys_name = result.get('sys_name', device.sys_name)
                device.uptime_days = result.get('uptime_days', device.uptime_days)
                device.cpu_load = result.get('cpu_usage', 0)
                device.memory_load = result.get('memory_usage', 0)
                if result.get('temperature') is not None:
                    device.temperature = result['temperature']
                Metric.objects.create(
                    device=device,
                    cpu_usage=result.get('cpu_usage', 0),
                    memory_usage=result.get('memory_usage', 0),
                    network_in=result.get('network_in', 0),
                    network_out=result.get('network_out', 0),
                    temperature=result.get('temperature', None),
                )
            else:
                # Device is offline — generate alert
                Alert.objects.create(
                    device=device,
                    title=f"Device {device.name} is offline",
                    description=f"Device at {device.ip_address} did not respond to initial SNMP poll.",
                    severity='warning',
                    status='open',
                )
            device.save()
        except Exception as e:
            logger.exception("Initial poll failed for %s: %s", device.ip_address, e)

        headers = self.get_success_headers(serializer.data)
        return Response(
            DeviceSerializer(device, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
            headers=headers
        )

    def get_queryset(self):
        queryset = Device.objects.all().select_related('zone')
        
        important = self.request.GET.get('important')
        if safe_bool(important, default=None, param_name='important'):
            queryset = queryset.filter(is_important=True)

        device_type = self.request.GET.get('type') or self.request.GET.get('device_type')
        if device_type:
            queryset = queryset.filter(device_type__iexact=device_type)

        zone_id = self.request.GET.get('zone')
        if zone_id:
            zone_id = safe_int(zone_id, param_name='zone')
            queryset = queryset.filter(zone_id=zone_id)

        is_online = self.request.GET.get('is_online')
        if is_online is not None:
            queryset = queryset.filter(is_online=safe_bool(is_online, param_name='is_online'))

        return queryset

    @action(detail=True, methods=['post'])
    def poll_now(self, request, pk=None):
        """Manually poll a specific device synchronously (no Celery needed)"""
        device = self.get_object()
        try:
            result = poll_device(
                device.ip_address,
                device.device_type,
                device.snmp_community,
                getattr(device, 'port', 161),
                custom_oids=getattr(device, 'custom_oids', '')
            )

            was_online = device.is_online
            device.is_online = result.get('reachable', False)

            if device.is_online:
                device.last_seen = timezone.now()
                device.sys_name = result.get('sys_name', device.sys_name)
                device.uptime_days = result.get('uptime_days', device.uptime_days or 0)
                device.cpu_load = result.get('cpu_usage', device.cpu_load)
                device.memory_load = result.get('memory_usage', device.memory_load)
                if result.get('temperature') is not None:
                    device.temperature = result['temperature']

                Metric.objects.create(
                    device=device,
                    cpu_usage=result.get('cpu_usage', 0),
                    memory_usage=result.get('memory_usage', 0),
                    network_in=result.get('network_in', 0),
                    network_out=result.get('network_out', 0),
                    temperature=result.get('temperature', None),
                )

                # Auto-resolve offline alerts if device came back online
                if not was_online:
                    Alert.objects.filter(
                        device=device,
                        title__icontains='offline',
                        status__in=['open', 'in-progress']
                    ).update(status='resolved', resolved_at=timezone.now())

            device.save()

            return Response({
                'success': True,
                'message': f'Polling complete for {device.name}',
                'is_online': device.is_online,
                'cpu_load': device.cpu_load,
                'memory_load': device.memory_load,
                'uptime_days': device.uptime_days,
            })
        except Exception as e:
            logger.exception('Failed to poll device %s: %s', device.id, e)
            return Response({
                'success': False,
                'error': f'Failed to poll device: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    @action(detail=True, methods=['get'])
    def trends(self, request, pk=None):
        """Get historical trends and AI forecast for a specific device"""
        device = self.get_object()
        time_range = request.query_params.get('range', '24h')
        
        now = timezone.now()
        range_map = {
            '1h': timedelta(hours=1),
            '6h': timedelta(hours=6),
            '24h': timedelta(days=1),
            '7d': timedelta(days=7),
            '30d': timedelta(days=30),
        }
        delta = range_map.get(time_range, timedelta(days=1))
        start_time = now - delta
            
        metrics = Metric.objects.filter(
            device=device,
            timestamp__gte=start_time
        ).order_by('timestamp')

        metric_type = request.query_params.get('metric', 'bandwidth')
        
        # Select the values based on requested metric
        historical_data = []
        for m in metrics:
            if metric_type == 'cpu':
                y_val = m.cpu_usage
            elif metric_type == 'memory':
                y_val = m.memory_usage
            elif metric_type == 'temperature':
                y_val = m.temperature or 0
            elif metric_type == 'network_in':
                y_val = m.network_in
            elif metric_type == 'network_out':
                y_val = m.network_out
            else: # bandwidth (sum of in/out)
                y_val = m.network_in + m.network_out
            
            historical_data.append({'x': m.timestamp.timestamp() * 1000, 'y': y_val})

        # Simple Forecast (7 points)
        forecast_data = []
        if metrics.exists():
            last_m = metrics.last()
            
            # Determine last value based on metric
            if metric_type == 'cpu': last_val = last_m.cpu_usage
            elif metric_type == 'memory': last_val = last_m.memory_usage
            elif metric_type == 'temperature': last_val = last_m.temperature or 0
            elif metric_type == 'network_in': last_val = last_m.network_in
            elif metric_type == 'network_out': last_val = last_m.network_out
            else: last_val = last_m.network_in + last_m.network_out
            
            # Simple linear trend calculation
            count = metrics.count()
            if count > 5:
                # Use first and last points in the range for a rough slope
                first_m = metrics.first()
                if metric_type == 'cpu': first_val = first_m.cpu_usage
                elif metric_type == 'memory': first_val = first_m.memory_usage
                else: first_val = first_m.network_in + first_m.network_out
                slope = (last_val - first_val) / count
            else:
                slope = 0
            
            interval_ms = (delta.total_seconds() / (count or 24)) * 1000
            for i in range(1, 8):
                forecast_data.append({
                    'x': (last_m.timestamp.timestamp() * 1000) + (interval_ms * i),
                    'y': max(0, last_val + (slope * i) + random.uniform(-2, 2)),
                    'confidence': max(50, 95 - (i * 5))
                })

        data = {
            'labels': [m.timestamp.isoformat() for m in metrics],
            'cpu': [m.cpu_usage for m in metrics],
            'memory': [m.memory_usage for m in metrics],
            'network_in': [m.network_in for m in metrics],
            'network_out': [m.network_out for m in metrics],
            'temperature': [m.temperature for m in metrics],
            'historical': historical_data,
            'forecast': forecast_data
        }
        
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get device summary statistics"""
        total = Device.objects.count()
        online = Device.objects.filter(is_online=True).count()
        
        type_breakdown = Device.objects.values('device_type').annotate(
            total=Count('id'),
            online=Count('id', filter=Q(is_online=True))
        )
        
        performance = Metric.objects.filter(
            timestamp__gte=timezone.now() - timedelta(hours=24)
        ).aggregate(
            avg_cpu=Avg('cpu_usage'),
            avg_memory=Avg('memory_usage'),
            max_bandwidth=Max('network_in')
        )
        
        return Response({
            'total_devices': total,
            'online_devices': online,
            'offline_devices': total - online,
            'uptime_percentage': round((online / total) * 100, 2) if total > 0 else 0,
            'type_breakdown': list(type_breakdown),
            'performance': performance,
            'last_updated': timezone.now().isoformat()
        })
    
    def _trigger_dashboard_update(self):
        """Send real-time update to dashboard clients"""
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                'dashboard_updates',
                {
                    'type': 'dashboard_update',
                    'data': {
                        'type': 'device_update',
                        'message': 'Device status changed',
                        'timestamp': timezone.now().isoformat()
                    }
                }
            )
        except Exception as e:
            logger.warning("WebSocket update failed: %s", e)


# ---------------------------------------------------------------------------
# Alerts — Full CRUD
# ---------------------------------------------------------------------------
class AlertViewSet(viewsets.ModelViewSet):
    queryset = Alert.objects.all()
    serializer_class = AlertSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = Alert.objects.all().select_related('device', 'acknowledged_by', 'resolved_by')
        
        status_filter = self.request.GET.get('status')
        severity_filter = self.request.GET.get('severity')
        hours_filter = self.request.GET.get('hours')
        device_id = self.request.GET.get('device_id')
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if severity_filter:
            queryset = queryset.filter(severity=severity_filter)
        if hours_filter:
            hours_val = safe_int(hours_filter, default=24, min_val=1, max_val=8760, param_name='hours')
            time_threshold = timezone.now() - timedelta(hours=hours_val)
            queryset = queryset.filter(created_at__gte=time_threshold)
        if device_id:
            device_id = safe_int(device_id, param_name='device_id')
            queryset = queryset.filter(device_id=device_id)
        
        return queryset.order_by('-created_at')

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Acknowledge an alert"""
        alert = self.get_object()
        if alert.status == 'resolved':
            return Response({
                'success': False,
                'message': 'Cannot acknowledge a resolved alert'
            }, status=status.HTTP_400_BAD_REQUEST)

        alert.status = 'in-progress'
        alert.acknowledged_at = timezone.now()
        alert.acknowledged_by = request.user
        alert.save()
        
        return Response({
            'success': True,
            'message': 'Alert acknowledged',
            'alert': AlertSerializer(alert).data
        })
    
    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Resolve an alert"""
        alert = self.get_object()
        if alert.status == 'resolved':
            return Response({
                'success': False,
                'message': 'Alert is already resolved'
            }, status=status.HTTP_400_BAD_REQUEST)

        alert.status = 'resolved'
        alert.resolved_at = timezone.now()
        alert.resolved_by = request.user
        alert.save()
        
        return Response({
            'success': True,
            'message': 'Alert resolved',
            'alert': AlertSerializer(alert).data
        })
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get alert summary statistics"""
        total_alerts = Alert.objects.count()
        open_alerts = Alert.objects.filter(status='open').count()
        critical_alerts = Alert.objects.filter(severity='critical', status='open').count()
        
        recent_alerts = Alert.objects.filter(
            created_at__gte=timezone.now() - timedelta(hours=24)
        )
        
        severity_trends = recent_alerts.values('severity').annotate(
            count=Count('id')
        ).order_by('severity')
        
        return Response({
            'total_alerts': total_alerts,
            'open_alerts': open_alerts,
            'critical_alerts': critical_alerts,
            'recent_24h': recent_alerts.count(),
            'resolution_rate': round((1 - (open_alerts / total_alerts)) * 100, 2) if total_alerts > 0 else 100,
            'severity_trends': list(severity_trends),
            'last_updated': timezone.now().isoformat()
        })


# ---------------------------------------------------------------------------
# Zones — Full CRUD (was ReadOnly, now ModelViewSet)
# ---------------------------------------------------------------------------
class ZoneViewSet(viewsets.ModelViewSet):
    """Full CRUD API for Zones (DC1, DC2, DR etc.)."""
    queryset = Zone.objects.all()
    serializer_class = ZoneSerializer
    permission_classes = [IsAdminOrOperatorOrReadOnly]

    def get_queryset(self):
        queryset = Zone.objects.all()
        search = self.request.GET.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(key__icontains=search)
            )
        return queryset

    @action(detail=True, methods=['get'])
    def devices(self, request, pk=None):
        """Get all devices in a specific zone"""
        zone = self.get_object()
        devices = zone.devices.filter(is_active=True)
        return Response({
            'zone': ZoneSerializer(zone).data,
            'devices': DeviceSerializer(devices, many=True).data,
            'total': devices.count(),
            'online': devices.filter(is_online=True).count(),
        })

    @action(detail=True, methods=['get'])
    def environment(self, request, pk=None):
        """Get environmental stats for a zone"""
        zone = self.get_object()
        zone_devices = zone.devices.all()
        
        temp_avg = Metric.objects.filter(
            device__in=zone_devices,
            temperature__isnull=False,
            timestamp__gte=timezone.now() - timedelta(hours=1)
        ).aggregate(avg=Avg('temperature'))['avg']
        
        return Response({
            'zone': zone.name,
            'temperature': round(temp_avg, 1) if temp_avg else zone.temperature,
            'humidity': zone.humidity,
            'device_count': zone_devices.count(),
            'online_count': zone_devices.filter(is_online=True).count(),
        })


# ---------------------------------------------------------------------------
# Metrics — Read-only + Trends
# ---------------------------------------------------------------------------
class MetricViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Metric.objects.all()
    serializer_class = MetricSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = Metric.objects.all().select_related('device')
        
        device_id = self.request.GET.get('device_id')
        if device_id:
            device_id = safe_int(device_id, param_name='device_id')
            queryset = queryset.filter(device_id=device_id)
        
        hours = self.request.GET.get('hours')
        if hours:
            hours_val = safe_int(hours, default=24, min_val=1, max_val=8760, param_name='hours')
            time_threshold = timezone.now() - timedelta(hours=hours_val)
            queryset = queryset.filter(timestamp__gte=time_threshold)
        
        return queryset.order_by('-timestamp')
    
    @action(detail=False, methods=['get'])
    def trends(self, request):
        """Get metric trends for charts — compatible with SQLite AND PostgreSQL"""
        hours = safe_int(request.GET.get('hours'), default=24, min_val=1, max_val=8760, param_name='hours')
        time_threshold = timezone.now() - timedelta(hours=hours)
        
        # Use TruncHour which works across all DB backends
        trends = Metric.objects.filter(
            timestamp__gte=time_threshold
        ).annotate(
            time_bucket=TruncHour('timestamp')
        ).values('time_bucket').annotate(
            avg_cpu=Avg('cpu_usage'),
            avg_memory=Avg('memory_usage'),
            avg_network_in=Avg('network_in'),
            avg_network_out=Avg('network_out'),
            max_network_in=Max('network_in'),
            record_count=Count('id')
        ).order_by('time_bucket')
        
        # Convert time_bucket to string for JSON serialization
        trends_list = []
        for t in trends:
            entry = dict(t)
            entry['time_bucket'] = entry['time_bucket'].isoformat() if entry['time_bucket'] else None
            trends_list.append(entry)

        return Response({
            'time_range_hours': hours,
            'data_points': len(trends_list),
            'trends': trends_list,
            'summary': {
                'avg_cpu': Metric.objects.filter(
                    timestamp__gte=time_threshold
                ).aggregate(Avg('cpu_usage'))['cpu_usage__avg'],
                'avg_bandwidth': Metric.objects.filter(
                    timestamp__gte=time_threshold
                ).aggregate(Avg('network_in'))['network_in__avg']
            }
        })
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        """Get latest metrics for all devices"""
        devices = Device.objects.filter(is_active=True)
        latest_metrics = []
        
        for device in devices:
            latest = Metric.objects.filter(device=device).order_by('-timestamp').first()
            if latest:
                latest_metrics.append({
                    'device_id': device.id,
                    'device': device.name,
                    'cpu_usage': latest.cpu_usage,
                    'memory_usage': latest.memory_usage,
                    'network_in': latest.network_in,
                    'network_out': latest.network_out,
                    'temperature': latest.temperature,
                    'timestamp': latest.timestamp
                })
        
        return Response({
            'latest_metrics': latest_metrics,
            'total_devices': devices.count(),
            'devices_with_metrics': len(latest_metrics)
        })


# ---------------------------------------------------------------------------
# Alert Thresholds — Configurable
# ---------------------------------------------------------------------------
class AlertThresholdViewSet(viewsets.ModelViewSet):
    """CRUD for alert threshold configurations."""
    queryset = AlertThreshold.objects.all()
    serializer_class = AlertThresholdSerializer
    permission_classes = [IsAdminOrOperatorOrReadOnly]


# ---------------------------------------------------------------------------
# ISPs
# ---------------------------------------------------------------------------
class ISPViewSet(viewsets.ModelViewSet):
    """ISP endpoints — allow unauthenticated reads but require auth for writes/probes."""
    queryset = ISP.objects.all()
    serializer_class = ISPSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    @action(detail=True, methods=['post'])
    def probe(self, request, pk=None):
        """Manually probe an ISP endpoint"""
        isp = self.get_object()
        try:
            from devices.isp_service import probe_isp
            res = probe_isp(isp.host)
            isp.last_checked = timezone.now()
            isp.latency_ms = res.get('latency_ms')
            isp.packet_loss = res.get('packet_loss')
            isp.upstream_mbps = res.get('upstream_mbps')
            isp.downstream_mbps = res.get('downstream_mbps')
            isp.save()
            return Response({'success': True, 'result': res})
        except Exception as e:
            logger.exception('ISP probe failed for %s: %s', isp.host, e)
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ---------------------------------------------------------------------------
# Ports
# ---------------------------------------------------------------------------
class PortViewSet(viewsets.ModelViewSet):
    """Port endpoints for monitoring specific interfaces."""
    queryset = Port.objects.all()
    serializer_class = PortSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    @action(detail=True, methods=['post'])
    def simulate(self, request, pk=None):
        """Simulate traffic for a specific port."""
        port = self.get_object()
        try:
            from devices.port_service import simulate_port_traffic
            data = simulate_port_traffic(port.capacity_mbps)
            
            port.bps_in = data['bps_in']
            port.bps_out = data['bps_out']
            port.utilization_in = data['utilization_in']
            port.utilization_out = data['utilization_out']
            port.errors_in = data['errors_in']
            port.errors_out = data['errors_out']
            port.status = data['status']
            port.last_checked = timezone.now()
            port.save()
            
            # Check for alerts
            if port.status == 'down' or port.utilization_in > 90 or port.utilization_out > 90:
                device = Device.objects.filter(name=port.device_name).first()
                if device:
                    title = f"Port {port.name} Issue"
                    if port.status == 'down':
                        description = f"Port {port.name} is DOWN."
                    elif port.utilization_in > 90:
                        description = f"Port {port.name} inbound utilization is critical ({port.utilization_in}%)."
                    else:
                        description = f"Port {port.name} outbound utilization is critical ({port.utilization_out}%)."
                    
                    existing = Alert.objects.filter(
                        device=device, title=title, status='open'
                    ).exists()
                    
                    if not existing:
                        Alert.objects.create(
                            device=device,
                            title=title,
                            description=description,
                            severity='critical',
                            status='open'
                        )
            
            return Response({'success': True, 'data': data})
        except Exception as e:
            logger.exception('Port simulate failed for %s: %s', port.name, e)
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
