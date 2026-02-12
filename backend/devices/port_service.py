import random
import time

def simulate_port_traffic(capacity_mbps):
    """
    Simulates traffic for a port based on its capacity.
    Returns a dict with simulated metrics.
    """
    # Simulate utilization between 10% and 90%
    util_in = random.uniform(10, 90)
    util_out = random.uniform(10, 90)
    
    # Calculate bps based on utilization
    bps_in = (util_in / 100.0) * capacity_mbps * 1_000_000
    bps_out = (util_out / 100.0) * capacity_mbps * 1_000_000
    
    # Simulate errors (low probability)
    errors_in = 0
    errors_out = 0
    if random.random() < 0.05:
        errors_in = random.randint(1, 10)
    if random.random() < 0.05:
        errors_out = random.randint(1, 10)
        
    # Determine status based on errors or random chance
    status = 'up'
    if random.random() < 0.01: # 1% chance of going down
        status = 'down'
        
    return {
        'bps_in': int(bps_in),
        'bps_out': int(bps_out),
        'utilization_in': round(util_in, 2),
        'utilization_out': round(util_out, 2),
        'errors_in': errors_in,
        'errors_out': errors_out,
        'status': status
    }
