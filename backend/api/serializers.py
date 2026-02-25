from rest_framework import serializers
from django.contrib.auth import authenticate
from django.core.validators import validate_ipv46_address
from .models import User, Device, Alert, Metric, Zone, AlertThreshold
from .models import ISP, Audit, Port


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'first_name', 'last_name')


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(
        max_length=150,
        error_messages={'required': 'Username is required', 'blank': 'Username cannot be blank'}
    )
    password = serializers.CharField(
        max_length=128,
        error_messages={'required': 'Password is required', 'blank': 'Password cannot be blank'}
    )

    def validate(self, data):
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username:
            raise serializers.ValidationError({'username': 'Username is required.'})
        if not password:
            raise serializers.ValidationError({'password': 'Password is required.'})

        user = authenticate(username=username, password=password)
        if user:
            if user.is_active:
                data['user'] = user
                return data
            else:
                raise serializers.ValidationError('User account is disabled.')
        else:
            raise serializers.ValidationError('Invalid username or password.')


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, min_length=6, max_length=128,
        error_messages={'min_length': 'Password must be at least 6 characters.'}
    )
    username = serializers.CharField(
        min_length=3, max_length=150,
        error_messages={'min_length': 'Username must be at least 3 characters.'}
    )
    email = serializers.EmailField(
        error_messages={'invalid': 'Enter a valid email address.'}
    )
    
    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'role')

    def validate_username(self, value):
        value = value.strip()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('A user with this username already exists.')
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value
    
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
    acknowledged_by_username = serializers.CharField(
        source='acknowledged_by.username', read_only=True, default=None
    )
    resolved_by_username = serializers.CharField(
        source='resolved_by.username', read_only=True, default=None
    )
    
    class Meta:
        model = Alert
        fields = '__all__'
        read_only_fields = ('created_at', 'acknowledged_at', 'resolved_at',
                           'acknowledged_by', 'resolved_by')

    def validate_severity(self, value):
        valid = [c[0] for c in Alert.SEVERITY_CHOICES]
        if value not in valid:
            raise serializers.ValidationError(f'Severity must be one of: {", ".join(valid)}')
        return value

    def validate_status(self, value):
        valid = [c[0] for c in Alert.STATUS_CHOICES]
        if value not in valid:
            raise serializers.ValidationError(f'Status must be one of: {", ".join(valid)}')
        return value


class MetricSerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source='device.name', read_only=True)

    class Meta:
        model = Metric
        fields = '__all__'
        read_only_fields = ('timestamp',)


class ZoneSerializer(serializers.ModelSerializer):
    device_count = serializers.SerializerMethodField()

    class Meta:
        model = Zone
        fields = ('id', 'name', 'key', 'description', 'temperature', 'humidity',
                  'device_count', 'created_at', 'updated_at')
        read_only_fields = ('created_at', 'updated_at')

    def get_device_count(self, obj):
        return obj.devices.count() if hasattr(obj, 'devices') else 0

    def validate_key(self, value):
        value = value.strip().lower()
        # On update, allow same key for same instance
        instance = getattr(self, 'instance', None)
        qs = Zone.objects.filter(key=value)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError('A zone with this key already exists.')
        return value


class AlertThresholdSerializer(serializers.ModelSerializer):
    class Meta:
        model = AlertThreshold
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')


class ISPSerializer(serializers.ModelSerializer):
    class Meta:
        model = ISP
        fields = ('id', 'name', 'host', 'is_active', 'last_checked', 'latency_ms',
                  'packet_loss', 'upstream_mbps', 'downstream_mbps',
                  'plan_download_mbps', 'plan_upload_mbps', 'is_flapping', 'provider_image')

    def validate_host(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Host cannot be empty.')
        return value


class PortSerializer(serializers.ModelSerializer):
    class Meta:
        model = Port
        fields = '__all__'


class DeviceSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    last_metrics = serializers.SerializerMethodField()
    zone = serializers.PrimaryKeyRelatedField(
        queryset=Zone.objects.all(), required=False, allow_null=True
    )
    zone_name = serializers.CharField(source='zone.name', read_only=True)
    
    class Meta:
        model = Device
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'is_online', 'last_seen',
                           'cpu_load', 'memory_load')
    
    def get_status(self, obj):
        return 'online' if obj.is_online else 'offline'
    
    def get_last_metrics(self, obj):
        last_metric = obj.metrics.order_by('-timestamp').first()
        if last_metric:
            return MetricSerializer(last_metric).data
        return None

    def validate_ip_address(self, value):
        # Validate format
        import ipaddress
        try:
            ipaddress.ip_address(value)
        except (ValueError, TypeError):
            raise serializers.ValidationError('Enter a valid IPv4 or IPv6 address.')

        # Prevent duplicate devices with the same IP
        instance = getattr(self, 'instance', None)
        qs = Device.objects.filter(ip_address=value)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError('A device with this IP address already exists.')
        return value

    def validate_name(self, value):
        value = value.strip()
        if len(value) < 1:
            raise serializers.ValidationError('Device name is required.')
        if len(value) > 100:
            raise serializers.ValidationError('Device name must be at most 100 characters.')
        return value

    def validate_device_type(self, value):
        valid = [c[0] for c in Device.DEVICE_TYPES]
        if value not in valid:
            raise serializers.ValidationError(f'Device type must be one of: {", ".join(valid)}')
        return value


class AuditSerializer(serializers.ModelSerializer):
    user = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Audit
        fields = ('id', 'event_type', 'user', 'ip_address', 'details', 'created_at')