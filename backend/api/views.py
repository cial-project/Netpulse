from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, Device, Alert, Metric
from .serializers import (UserSerializer, LoginSerializer, SignupSerializer, 
                         DeviceSerializer, AlertSerializer, MetricSerializer)

class AuthViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]
    
    @action(detail=False, methods=['post'])
    def login(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            refresh = RefreshToken.for_user(user)
            return Response({
                'success': True,
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
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
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return User.objects.filter(id=self.request.user.id)
    
    @action(detail=False)
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

class DashboardViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    
    @action(detail=False)
    def kpi(self, request):
        # Dynamic device status
        total_devices = Device.objects.count()
        online_devices = Device.objects.filter(is_active=True).count()
        devices_status = f"{online_devices}/{total_devices} Online"

        # Dynamic active alerts
        critical_alerts = Alert.objects.filter(severity='critical', status='open').count()
        warning_alerts = Alert.objects.filter(severity='warning', status='open').count()
        active_alerts = f"{critical_alerts} Critical, {warning_alerts} Warning"

        # Dynamic average temperature (last 24h)
        from django.utils import timezone
        from datetime import timedelta
        from django.db.models import Avg
        last_24h = timezone.now() - timedelta(hours=24)
        temp_metrics = Metric.objects.filter(temperature__isnull=False, timestamp__gte=last_24h)
        if temp_metrics.exists():
            avg_temp = round(temp_metrics.aggregate(Avg('temperature'))['temperature__avg'], 1)
            avg_temperature = f"{avg_temp}°C"
        else:
            avg_temperature = "N/A"

        # Dynamic bandwidth, throughput, latency, jitter (last 24h)
        # For demo, use network_in as bandwidth, network_out as throughput, and fake latency/jitter
        avg_bandwidth = avg_throughput = avg_latency = avg_jitter = None
        if temp_metrics.exists():
            avg_bandwidth = round(temp_metrics.aggregate(Avg('network_in'))['network_in__avg'], 2)
            avg_throughput = round(temp_metrics.aggregate(Avg('network_out'))['network_out__avg'], 2)
            # If you have latency/jitter fields, use them; else, use placeholders
            avg_latency = 23  # Placeholder, replace with real calculation if available
            avg_jitter = 2    # Placeholder, replace with real calculation if available
        else:
            avg_bandwidth = avg_throughput = avg_latency = avg_jitter = 'N/A'

        # UPS status: If you have a model/field, use it; else, placeholder
        ups_status = '95% Capacity'  # TODO: Replace with real UPS data if available

        data = {
            'devices_status': devices_status,
            'active_alerts': active_alerts,
            'avg_temperature': avg_temperature,
            'ups_status': ups_status,
            'bandwidth': f"{avg_bandwidth} Mbps" if avg_bandwidth != 'N/A' else 'N/A',
            'throughput': f"{avg_throughput} Mbps" if avg_throughput != 'N/A' else 'N/A',
            'latency': f"{avg_latency} ms" if avg_latency != 'N/A' else 'N/A',
            'jitter': f"{avg_jitter} ms" if avg_jitter != 'N/A' else 'N/A',
        }
        return Response(data)
    
    @action(detail=False)
    def ai_insights(self, request):
        insights = [
            "Multiple temperature alerts in Terminal 1 may be related to HVAC system issue.",
            "Network device failures appear to be clustered around Switch-T1-A.",
            "Bandwidth usage shows unusual pattern on Router-02. Predicted to exceed normal thresholds in 4 hours."
        ]
        return Response({'insights': insights})
    
    @action(detail=False)
    def map(self, request):
        zones = [
            {'top': '10%', 'left': '15%', 'status': 'normal', 'label': 'T1'},
            {'top': '25%', 'left': '40%', 'status': 'warning', 'label': 'T2'},
            {'top': '60%', 'left': '30%', 'status': 'critical', 'label': 'Baggage'},
            {'top': '45%', 'left': '70%', 'status': 'normal', 'label': 'Control'}
        ]
        legend = [
            {'status': 'normal', 'label': 'Normal', 'count': 25},
            {'status': 'warning', 'label': 'Warning', 'count': 12},
            {'status': 'critical', 'label': 'Critical', 'count': 5}
        ]
        return Response({'zones': zones, 'legend': legend})
    
    @action(detail=False)
    def stats(self, request):
        data = {
            'temperature': {
                'value': 22.5,
                'progress': '65%',
                'comparison': '+2.3° from yesterday'
            },
            'humidity': {
                'value': 45,
                'progress': '45%',
                'comparison': 'Within normal range'
            },
            'passenger_systems': {
                'value': 92,
                'progress': '92%',
                'comparison': 'Optimal performance'
            }
        }
        return Response(data)

class DeviceViewSet(viewsets.ModelViewSet):
    queryset = Device.objects.all()
    serializer_class = DeviceSerializer
    permission_classes = [IsAuthenticated]

class AlertViewSet(viewsets.ModelViewSet):
    queryset = Alert.objects.all()
    serializer_class = AlertSerializer
    permission_classes = [IsAuthenticated]

class MetricViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Metric.objects.all()
    serializer_class = MetricSerializer
    permission_classes = [IsAuthenticated]