from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, Device, Alert, Metric

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

class DeviceSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    
    class Meta:
        model = Device
        fields = '__all__'
    
    def get_status(self, obj):
        # This would be determined by SNMP polling in real implementation
        return 'online'  # Placeholder

class AlertSerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source='device.name', read_only=True)
    
    class Meta:
        model = Alert
        fields = '__all__'

class MetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = Metric
        fields = '__all__'

class DeviceSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    last_metrics = serializers.SerializerMethodField()
    
    class Meta:
        model = Device
        fields = '__all__'
    
    def get_status(self, obj):
        return 'online' if obj.is_online else 'offline'
    
    def get_last_metrics(self, obj):
        last_metric = obj.metrics.order_by('-timestamp').first()
        if last_metric:
            return MetricSerializer(last_metric).data
        return None