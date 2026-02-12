from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.hashers import make_password

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
        if self.password and not self.password.startswith('pbkdf2_sha256$'):
            self.password = make_password(self.password)
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.username} ({self.role})"

class Device(models.Model):
    DEVICE_TYPES = [
        ('router', 'Router'),
        ('switch', 'Switch'),
        ('firewall', 'Firewall'),
        ('ap', 'Access Point'),
        ('server', 'Server'),
    ]
    
    name = models.CharField(max_length=100)
    # Optional relation to a Zone (e.g., DC1, DC2, DR)
    # Added to support explicit zone management requested by the user
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
    # SNMP port to contact the device (default 161)
    port = models.IntegerField(default=161)
    # Per-device polling interval (seconds). If null/0, server default is used.
    poll_interval_seconds = models.IntegerField(null=True, blank=True, default=None)
    # Optional JSON/text field where operator can list custom SNMP OIDs or key=value pairs
    # to read for this device. Stored as newline-separated values or JSON string.
    custom_oids = models.TextField(blank=True, default='')
    # Mark devices that should appear in the concise Device Grid (top 4)
    is_important = models.BooleanField(default=False)
    
    # Real-time metrics cache (for static/snapshot views)
    cpu_load = models.FloatField(default=0.0, help_text="Current CPU Load %")
    memory_load = models.FloatField(default=0.0, help_text="Current Memory Used %")
    temperature = models.FloatField(null=True, blank=True, help_text="Device Temperature (C)")
    uplink_capacity = models.CharField(max_length=50, default="10 Gbps", help_text="Uplink Connection Speed")
    
    def __str__(self):
        status = "Online" if self.is_online else "Offline"
        return f"{self.name} ({self.ip_address}) - {status}"

    def __str__(self):
        return f"{self.name} ({self.ip_address})"

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
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.severity.upper()}: {self.title}"

class Metric(models.Model):
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='metrics')
    cpu_usage = models.FloatField()  # percentage
    memory_usage = models.FloatField()  # percentage
    network_in = models.FloatField()  # Mbps
    network_out = models.FloatField()  # Mbps
    temperature = models.FloatField(null=True, blank=True)  # Celsius
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']

class Zone(models.Model):
    """Represents a named zone/location such as DC1, DC2 or DR."""
    name = models.CharField(max_length=100, unique=True)
    key = models.SlugField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    # Environmental Data
    temperature = models.FloatField(null=True, blank=True, help_text="Current temperature in Celsius")
    humidity = models.FloatField(null=True, blank=True, help_text="Current humidity percentage")

    def __str__(self):
        return self.name


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
    # Plan Details
    plan_download_mbps = models.FloatField(default=100.0, help_text="Plan Download Speed Limit")
    plan_upload_mbps = models.FloatField(default=100.0, help_text="Plan Upload Speed Limit")
    is_flapping = models.BooleanField(default=False)
    provider_image = models.CharField(max_length=255, blank=True, help_text="Path to provider logo image")

    def __str__(self):
        return f"{self.name} ({self.host})"


class Port(models.Model):
    """Represents a network interface/port on a device for detailed monitoring."""
    name = models.CharField(max_length=100, help_text="e.g., GigabitEthernet0/1")
    device_name = models.CharField(max_length=100, help_text="Name of the switch/router")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    capacity_mbps = models.IntegerField(default=1000, help_text="Port speed in Mbps")
    is_active = models.BooleanField(default=True)
    status = models.CharField(max_length=10, default='up')
    last_checked = models.DateTimeField(null=True, blank=True)
    
    # Current Metrics
    bps_in = models.BigIntegerField(default=0)
    bps_out = models.BigIntegerField(default=0)
    utilization_in = models.FloatField(default=0.0) # Percentage
    utilization_out = models.FloatField(default=0.0) # Percentage
    errors_in = models.IntegerField(default=0)
    errors_out = models.IntegerField(default=0)
    # Advanced Metrics
    latency_ms = models.FloatField(default=0.0)
    packet_drops = models.FloatField(default=0.0, help_text="Percentage of packet drops")
    is_flapping = models.BooleanField(default=False)
    critical_alert_count = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.device_name} - {self.name}"


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

    def __str__(self):
        return f"{self.event_type} - {self.user} @ {self.ip_address}"
    
