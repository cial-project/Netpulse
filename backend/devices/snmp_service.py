import random
from typing import Dict
import logging

logger = logging.getLogger(__name__)

def get_device_status(ip: str, community: str = 'public') -> Dict:
    """Demo mode - simulate device status and metrics"""
    
    # Use the IP to determine "online" status consistently
    ip_hash = hash(ip) % 100
    is_online = ip_hash < 80  # 80% of devices online
    
    if is_online:
        # Online device with realistic metrics
        return {
            'status': 'up',
            'reachable': True,
            'sys_name': f"Device-{ip.replace('.', '-')}",
            'sys_description': 'Simulated network device',
            'uptime_days': round(random.uniform(1, 90), 2),
            'cpu_usage': round(random.uniform(5, 45), 1),  # 5-45% CPU
            'memory_usage': round(random.uniform(20, 75), 1),  # 20-75% memory
            'network_in': round(random.uniform(50, 800), 1),  # 50-800 Mbps
            'network_out': round(random.uniform(25, 400), 1),  # 25-400 Mbps
            'temperature': round(random.uniform(18, 28), 1) if random.random() > 0.7 else None
        }
    else:
        # Offline device
        return {
            'status': 'down', 
            'reachable': False,
            'error': 'Device not responding (demo mode)'
        }

def poll_device(ip: str, device_type: str, community: str = 'public') -> Dict:
    """Complete device polling - status + metrics (demo mode)"""
    return get_device_status(ip, community)