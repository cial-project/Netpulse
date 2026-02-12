from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, Device, Alert, Metric, Zone
from .models import ISP, Audit, Port

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'first_name', 'last_name')

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

    def validate(self, data):
        username = data.get('username')
        password = data.get('password')
        
        if username and password:
            user = authenticate(username=username, password=password)
            if user:
                if user.is_active:
                    data['user'] = user
                    return data
                else:
                    raise serializers.ValidationError('User account is disabled.')
            else:
                raise serializers.ValidationError('Invalid username or password.')
        else:
            raise serializers.ValidationError('Must include username and password.')

class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'role')
    
    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            role=validated_data.get('role', 'viewer')
        )
        return user

class AlertSerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source='device.name', read_only=True)
    
    class Meta:
        model = Alert
        fields = '__all__'

class MetricSerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source='device.name', read_only=True)

    class Meta:
        model = Metric
        fields = '__all__'


class ZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Zone
        fields = ('id', 'name', 'key', 'description', 'temperature', 'humidity')


class ISPSerializer(serializers.ModelSerializer):
    class Meta:
        model = ISP
        fields = ('id', 'name', 'host', 'is_active', 'last_checked', 'latency_ms', 'packet_loss', 'upstream_mbps', 'downstream_mbps', 'plan_download_mbps', 'plan_upload_mbps', 'is_flapping', 'provider_image')

class PortSerializer(serializers.ModelSerializer):
    class Meta:
        model = Port
        fields = '__all__'

class DeviceSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    last_metrics = serializers.SerializerMethodField()
    # Accept ID for writing, return ID for reading (default), but we add zone_name for display
    zone = serializers.PrimaryKeyRelatedField(queryset=Zone.objects.all(), required=False, allow_null=True)
    zone_name = serializers.CharField(source='zone.name', read_only=True)
    
    class Meta:
        model = Device
        # Expose is_important and zone in the API
        fields = '__all__'
    
    def get_status(self, obj):
        return 'online' if obj.is_online else 'offline'
    
    def get_last_metrics(self, obj):
        last_metric = obj.metrics.order_by('-timestamp').first()
        if last_metric:
            return MetricSerializer(last_metric).data
        return None

    def validate_ip_address(self, value):
        # Prevent creating duplicate devices with the same IP
        request = self.context.get('request')
        # When updating, allow same instance
        instance = getattr(self, 'instance', None)
        qs = Device.objects.filter(ip_address=value)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError('A device with this IP address already exists.')
        return value


class AuditSerializer(serializers.ModelSerializer):
    user = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Audit
        # Will be set at import time to avoid circular import during startup
        fields = ('id', 'event_type', 'user', 'ip_address', 'details', 'created_at')