import socket
import time
import random
import logging

logger = logging.getLogger('poller')

def probe_isp(host, count=4, timeout=2):
    """Probe an ISP host using socket to avoid 500 errors on Render."""
    latency_list = []
    success_count = 0
    port = 80
    
    for _ in range(count):
        try:
            start_time = time.time()
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(timeout)
            s.connect((host, port))
            s.close()
            latency_list.append((time.time() - start_time) * 1000)
            success_count += 1
        except Exception:
            pass
            
    if success_count > 0:
        packet_loss = ((count - success_count) / count) * 100.0
        latency = sum(latency_list) / len(latency_list) if latency_list else 0.0
        upstream_mbps = 0.0
        downstream_mbps = 0.0
    else:
        packet_loss = 100.0
        latency = None
        upstream_mbps = 0.0
        downstream_mbps = 0.0

    res = {
        'latency_ms': round(latency, 2) if latency is not None else None,
        'packet_loss': packet_loss,
        'upstream_mbps': upstream_mbps,
        'downstream_mbps': downstream_mbps,
        'raw_output': f"Socket ping to {host}"
    }
    logger.debug('ISP probe %s -> %s', host, res)
    return res
