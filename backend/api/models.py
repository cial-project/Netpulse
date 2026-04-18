from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.hashers import make_password
from django.core.validators import MinValueValidator, MaxValueValidator, validate_ipv46_address


class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Administrator'),
        ('operator', 'Operator'),
        ('viewer', 'Viewer'),
    ]
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='viewer')
    email = models.EmailField(unique=True)
    
    # Add unique related names to avoid clashes with built-in User model
    groups = models.ManyToManyField(
        'auth.Group',
        verbose_name='groups',
        blank=True,
        help_text='The groups this user belongs to.',
        related_name='api_user_set',
        related_query_name='api_user',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        verbose_name='user permissions',
        blank=True,
        help_text='Specific permissions for this user.',
        related_name='api_user_set',
        related_query_name='api_user',
    )
    
    def save(self, *args, **kwargs):
        if self.password and not self.password.startswith(('pbkdf2_sha256$', 'bcrypt', 'argon2')):
            self.password = make_password(self.password)
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.username} ({self.role})"


class Zone(models.Model):
    """Represents a named zone/location such as DC1, DC2 or DR."""
    name = models.CharField(max_length=100, unique=True)
    key = models.SlugField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    zone_type = models.CharField(max_length=50, default='operations', choices=[
        ('server', 'Server Room'),
        ('public', 'Public Area'),
        ('operations', 'Operations'),
        ('critical', 'Critical Infrastructure'),
        ('storage', 'Storage Area'),
    ])
    # Environmental Data
    temperature = models.FloatField(null=True, blank=True, help_text="Current temperature in Celsius")
    humidity = models.FloatField(null=True, blank=True, help_text="Current humidity percentage")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['key'], name='idx_zone_key'),
        ]

    def __str__(self):
        return self.name


class Device(models.Model):
    DEVICE_TYPES = [
        ('router', 'Router'),
        ('switch', 'Switch'),
        ('firewall', 'Firewall'),
        ('ap', 'Access Point'),
        ('server', 'Server'),
    ]
    
    name = models.CharField(max_length=100)
    zone = models.ForeignKey(
        'Zone', on_delete=models.SET_NULL, null=True, blank=True, related_name='devices'
    )
    ip_address = models.GenericIPAddressField(unique=True)
    device_type = models.CharField(max_length=20, choices=DEVICE_TYPES)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    location = models.CharField(max_length=200, blank=True)
    snmp_community = models.CharField(max_length=100, default='public')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(null=True, blank=True)
    sys_name = models.CharField(max_length=100, blank=True)
    uptime_days = models.FloatField(default=0)
    port = models.IntegerField(default=161, validators=[MinValueValidator(1), MaxValueValidator(65535)])
    poll_interval_seconds = models.IntegerField(null=True, blank=True, default=None)
    custom_oids = models.TextField(blank=True, default='')
    is_important = models.BooleanField(default=False)
    
    # Real-time metrics cache
    cpu_load = models.FloatField(default=0.0, help_text="Current CPU Load %")
    memory_load = models.FloatField(default=0.0, help_text="Current Memory Used %")
    temperature = models.FloatField(null=True, blank=True, help_text="Device Temperature (C)")
    ups_battery_level = models.FloatField(null=True, blank=True, help_text="UPS Battery Level %")
    uplink_capacity = models.CharField(max_length=50, default="10 Gbps", help_text="Uplink Connection Speed")

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['is_online'], name='idx_device_online'),
            models.Index(fields=['is_active'], name='idx_device_active'),
            models.Index(fields=['ip_address'], name='idx_device_ip'),
            models.Index(fields=['device_type'], name='idx_device_type'),
            models.Index(fields=['is_active', 'is_online'], name='idx_device_active_online'),
        ]
    
    def __str__(self):
        status = "Online" if self.is_online else "Offline"
        return f"{self.name} ({self.ip_address}) - {status}"


class Alert(models.Model):
    SEVERITY_CHOICES = [
        ('critical', 'Critical'),
        ('warning', 'Warning'),
        ('info', 'Info'),
    ]
    
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('in-progress', 'In Progress'),
        ('resolved', 'Resolved'),
    ]
    
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='alerts')
    title = models.CharField(max_length=200)
    description = models.TextField()
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='acknowledged_alerts'
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='resolved_alerts'
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'severity'], name='idx_alert_status_severity'),
            models.Index(fields=['device', 'status'], name='idx_alert_device_status'),
            models.Index(fields=['created_at'], name='idx_alert_created'),
            models.Index(fields=['severity', 'status', 'created_at'], name='idx_alert_sev_stat_date'),
        ]
    
    def __str__(self):
        return f"{self.severity.upper()}: {self.title}"


class Metric(models.Model):
    device = models.ForeignKey('Device', on_delete=models.CASCADE, related_name='metrics', null=True, blank=True)
    isp = models.ForeignKey('ISP', on_delete=models.CASCADE, related_name='metrics', null=True, blank=True)
    
    cpu_usage = models.FloatField(default=0.0)  # percentage
    memory_usage = models.FloatField(default=0.0)  # percentage
    network_in = models.FloatField(default=0.0)  # Mbps (or Latency for ISP)
    network_out = models.FloatField(default=0.0)  # Mbps (or Loss for ISP)
    temperature = models.FloatField(null=True, blank=True)  # Celsius
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['device', '-timestamp'], name='idx_metric_device_time'),
            models.Index(fields=['isp', '-timestamp'], name='idx_metric_isp_time'),
            models.Index(fields=['-timestamp'], name='idx_metric_timestamp'),
            models.Index(fields=['device', 'timestamp'], name='idx_metric_dev_ts_asc'),
            models.Index(fields=['isp', 'timestamp'], name='idx_metric_isp_ts_asc'),
        ]

    def __str__(self):
        owner = self.device.name if self.device else (self.isp.name if self.isp else "Unknown")
        return f"Metric({owner} @ {self.timestamp})"


class AlertThreshold(models.Model):
    """Configurable alert thresholds — one row per metric type."""
    METRIC_CHOICES = [
        ('cpu_usage', 'CPU Usage %'),
        ('memory_usage', 'Memory Usage %'),
        ('temperature', 'Temperature °C'),
        ('network_in', 'Network In Mbps'),
        ('network_out', 'Network Out Mbps'),
    ]
    SEVERITY_CHOICES = [
        ('critical', 'Critical'),
        ('warning', 'Warning'),
    ]

    metric_name = models.CharField(max_length=30, choices=METRIC_CHOICES)
    threshold_value = models.FloatField(help_text="Trigger alert when metric exceeds this value")
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='warning')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('metric_name', 'severity')
        ordering = ['metric_name']

    def __str__(self):
        return f"{self.metric_name} > {self.threshold_value} → {self.severity}"


class ISP(models.Model):
    """Represents an upstream ISP endpoint to monitor (ping/latency/bandwidth)."""
    name = models.CharField(max_length=150, unique=True)
    host = models.CharField(max_length=200, help_text='IP address or hostname to probe')
    is_active = models.BooleanField(default=True)
    last_checked = models.DateTimeField(null=True, blank=True)
    latency_ms = models.FloatField(null=True, blank=True)
    packet_loss = models.FloatField(null=True, blank=True)
    upstream_mbps = models.FloatField(null=True, blank=True)
    downstream_mbps = models.FloatField(null=True, blank=True)
    plan_download_mbps = models.FloatField(default=100.0, help_text="Plan Download Speed Limit")
    plan_upload_mbps = models.FloatField(default=100.0, help_text="Plan Upload Speed Limit")
    is_flapping = models.BooleanField(default=False)
    provider_image = models.CharField(max_length=255, blank=True, help_text="Path to provider logo image")

    class Meta:
        verbose_name = 'ISP'
        verbose_name_plural = 'ISPs'

    def __str__(self):
        return f"{self.name} ({self.host})"


class Port(models.Model):
    """Represents a network interface/port on a device for detailed monitoring."""
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='ports', null=True, blank=True)
    name = models.CharField(max_length=100, help_text="e.g., GigabitEthernet0/1")
    port_number = models.IntegerField(default=0)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    capacity_mbps = models.IntegerField(default=1000, help_text="Port speed in Mbps")
    is_active = models.BooleanField(default=True)
    status = models.CharField(max_length=10, default='up')
    last_checked = models.DateTimeField(null=True, blank=True)
    
    # Current Metrics
    bps_in = models.BigIntegerField(default=0)
    bps_out = models.BigIntegerField(default=0)
    utilization_in = models.FloatField(default=0.0)
    utilization_out = models.FloatField(default=0.0)
    errors_in = models.IntegerField(default=0)
    errors_out = models.IntegerField(default=0)
    # Advanced Metrics
    latency_ms = models.FloatField(default=0.0)
    packet_drops = models.FloatField(default=0.0, help_text="Percentage of packet drops")
    is_flapping = models.BooleanField(default=False)
    critical_alert_count = models.IntegerField(default=0)

    class Meta:
        ordering = ['device', 'name']

    def __str__(self):
        return f"{self.device.name if self.device else 'Unknown'} - {self.name}"


class Audit(models.Model):
    """Simple audit log for login/logout and SIEM-forwarded events."""
    EVENT_CHOICES = [
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('siem', 'SIEM'),
        ('other', 'Other'),
    ]

    event_type = models.CharField(max_length=20, choices=EVENT_CHOICES)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    details = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at'], name='idx_audit_created'),
            models.Index(fields=['event_type'], name='idx_audit_event_type'),
        ]

    def __str__(self):
        return f"{self.event_type} - {self.user} @ {self.ip_address}"
