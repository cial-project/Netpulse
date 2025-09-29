from django.contrib import admin
from .models import User, Device, Alert, Metric

# Register your models here
@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ('name', 'ip_address', 'device_type', 'is_online', 'last_seen')
    list_filter = ('device_type', 'is_online', 'is_active')
    search_fields = ('name', 'ip_address')
    list_per_page = 20

@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ('title', 'device', 'severity', 'status', 'created_at')
    list_filter = ('severity', 'status', 'created_at')
    search_fields = ('title', 'device__name')
    list_per_page = 20

@admin.register(Metric)
class MetricAdmin(admin.ModelAdmin):
    list_display = ('device', 'cpu_usage', 'memory_usage', 'network_in', 'timestamp')
    list_filter = ('device', 'timestamp')
    search_fields = ('device__name',)
    list_per_page = 50
    date_hierarchy = 'timestamp'

# User model is already registered by Django, but we can customize it
admin.site.register(User)