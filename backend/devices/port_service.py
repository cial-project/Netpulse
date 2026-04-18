import random
import time

def simulate_port_traffic(capacity_mbps):
    """
    Returns actual port traffic (currently 0s as real SNMP is not configured).
    """
    return {
        'bps_in': 0,
        'bps_out': 0,
        'utilization_in': 0.0,
        'utilization_out': 0.0,
        'errors_in': 0,
        'errors_out': 0,
        'latency_ms': None,
        'packet_drops': 0,
        'is_flapping': False,
        'status': 'up'
    }
