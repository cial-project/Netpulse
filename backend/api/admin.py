from django.contrib import admin
from .models import User, Device, Alert, Metric, Zone, ISP, Port, Audit, AlertThreshold


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ('name', 'ip_address', 'device_type', 'zone', 'is_online', 'is_active', 'is_important', 'last_seen', 'cpu_load', 'memory_load')
    list_filter = ('device_type', 'is_online', 'is_active', 'zone')
    search_fields = ('name', 'ip_address', 'sys_name', 'location')
    list_per_page = 25
    list_editable = ('is_active', 'is_important')
    raw_id_fields = ('zone',)


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ('title', 'device', 'severity', 'status', 'created_at', 'acknowledged_by', 'resolved_by')
    list_filter = ('severity', 'status', 'created_at')
    search_fields = ('title', 'device__name', 'description')
    list_per_page = 25
    readonly_fields = ('created_at',)
    raw_id_fields = ('device', 'acknowledged_by', 'resolved_by')


@admin.register(Metric)
class MetricAdmin(admin.ModelAdmin):
    list_display = ('device', 'cpu_usage', 'memory_usage', 'network_in', 'network_out', 'temperature', 'timestamp')
    list_filter = ('device', 'timestamp')
    search_fields = ('device__name',)
    list_per_page = 50
    date_hierarchy = 'timestamp'
    readonly_fields = ('timestamp',)


@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = ('name', 'key', 'temperature', 'humidity', 'device_count', 'created_at')
    search_fields = ('name', 'key')
    list_per_page = 25
    prepopulated_fields = {'key': ('name',)}

    def device_count(self, obj):
        return obj.devices.count()
    device_count.short_description = 'Devices'


@admin.register(ISP)
class ISPAdmin(admin.ModelAdmin):
    list_display = ('name', 'host', 'is_active', 'latency_ms', 'packet_loss', 'last_checked')
    list_filter = ('is_active', 'is_flapping')
    search_fields = ('name', 'host')
    list_per_page = 25


@admin.register(Port)
class PortAdmin(admin.ModelAdmin):
    list_display = ('name', 'device_name', 'status', 'utilization_in', 'utilization_out', 'is_active', 'last_checked')
    list_filter = ('status', 'is_active', 'is_flapping')
    search_fields = ('name', 'device_name')
    list_per_page = 25


@admin.register(Audit)
class AuditAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'user', 'ip_address', 'created_at')
    list_filter = ('event_type', 'created_at')
    search_fields = ('user__username', 'ip_address', 'details')
    list_per_page = 50
    readonly_fields = ('created_at',)
    date_hierarchy = 'created_at'


@admin.register(AlertThreshold)
class AlertThresholdAdmin(admin.ModelAdmin):
    list_display = ('metric_name', 'threshold_value', 'severity', 'is_active', 'updated_at')
    list_filter = ('metric_name', 'severity', 'is_active')
    list_editable = ('threshold_value', 'is_active')
    list_per_page = 25


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'role', 'is_active', 'date_joined')
    list_filter = ('role', 'is_active')
    search_fields = ('username', 'email')
    list_per_page = 25