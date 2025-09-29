import random
from typing import Dict
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Store device states to maintain consistency
_device_states = {}

def get_device_status(ip: str, community: str = 'public') -> Dict:
    """Enhanced demo mode - realistic device simulation"""
    
    # Initialize or get existing state for this IP
    if ip not in _device_states:
        # Determine initial state based on IP (consistent behavior)
        ip_hash = hash(ip) % 100
        _device_states[ip] = {
            'is_online': ip_hash < 85,  # 85% online initially
            'last_change': datetime.now(),
            'metrics_history': []
        }
    
    state = _device_states[ip]
    
    # Occasionally change state (5% chance to flip status)
    if random.random() < 0.05 and (datetime.now() - state['last_change']).seconds > 300:
        state['is_online'] = not state['is_online']
        state['last_change'] = datetime.now()
    
    if state['is_online']:
        # Online device with realistic, slowly changing metrics
        base_metrics = {
            'sys_name': f"Device-{ip.replace('.', '-')}",
            'uptime_days': max(1, random.randint(1, 180)),
            'cpu_usage': max(5, min(95, random.gauss(25, 15))),
            'memory_usage': max(15, min(90, random.gauss(45, 20))),
            'network_in': random.randint(50, 800),
            'network_out': random.randint(20, 400),
        }
        
        # Add temperature for some devices (30% chance)
        if random.random() < 0.3:
            base_metrics['temperature'] = round(random.uniform(18, 32), 1)
        
        # Store metrics for trend simulation
        state['metrics_history'].append({
            'timestamp': datetime.now(),
            'metrics': base_metrics
        })
        
        # Keep only last 100 records
        if len(state['metrics_history']) > 100:
            state['metrics_history'].pop(0)
        
        return {
            'status': 'up',
            'reachable': True,
            **base_metrics
        }
    else:
        # Offline device
        return {
            'status': 'down', 
            'reachable': False,
            'error': 'Device not responding - SNMP timeout',
            'sys_name': f"Device-{ip.replace('.', '-')}",
            'uptime_days': 0,
            'cpu_usage': 0,
            'memory_usage': 0,
            'network_in': 0,
            'network_out': 0
        }

def poll_device(ip: str, device_type: str, community: str = 'public') -> Dict:
    """Complete device polling with enhanced demo data"""
    result = get_device_status(ip, community)
    
    # Add device-type specific characteristics
    if result['reachable']:
        if device_type == 'router':
            result['cpu_usage'] = min(90, result['cpu_usage'] + random.randint(5, 20))
        elif device_type == 'firewall':
            result['network_in'] = min(1000, result['network_in'] + random.randint(100, 300))
        elif device_type == 'ap':
            result['temperature'] = result.get('temperature', round(random.uniform(25, 35), 1))
    
    return result

def get_device_metrics_trend(ip: str, hours: int = 24):
    """Generate realistic metric trends for charts"""
    if ip not in _device_states:
        return []
    
    state = _device_states[ip]
    now = datetime.now()
    
    # Generate trend data points
    trends = []
    for i in range(hours):
        point_time = now - timedelta(hours=hours - i - 1)
        
        # Find closest metrics or generate synthetic ones
        base_metric = state['metrics_history'][-1]['metrics'] if state['metrics_history'] else {
            'cpu_usage': random.randint(10, 40),
            'network_in': random.randint(100, 500),
            'network_out': random.randint(50, 250)
        }
        
        # Add some variation
        trends.append({
            'timestamp': point_time.isoformat(),
            'cpu_usage': max(5, base_metric['cpu_usage'] + random.randint(-10, 10)),
            'network_in': max(10, base_metric['network_in'] + random.randint(-50, 50)),
            'network_out': max(5, base_metric['network_out'] + random.randint(-25, 25))
        })
    
    return trends