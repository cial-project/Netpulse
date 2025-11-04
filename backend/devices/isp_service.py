import subprocess
import platform
import re
import logging

logger = logging.getLogger('poller')

def probe_isp(host, count=4, timeout=2):
    """Probe an ISP host using system ping and return latency and packet loss.
    Returns dict: latency_ms (float avg), packet_loss (float percent), upstream_mbps, downstream_mbps
    (bandwidth numbers are placeholders and None by default).
    """
    system = platform.system().lower()
    if system == 'windows':
        cmd = ['ping', host, '-n', str(count), '-w', str(timeout * 1000)]
    else:
        cmd = ['ping', '-c', str(count), '-W', str(timeout), host]

    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, universal_newlines=True)
    except subprocess.CalledProcessError as e:
        out = e.output

    # Parse packet loss
    packet_loss = None
    latency = None

    # Windows: "Lost = 0 (0% loss)" and "Average = 10ms" in statistics
    if system == 'windows':
        m_loss = re.search(r"Lost = \d+ \((\d+)% loss\)", out)
        if m_loss:
            packet_loss = float(m_loss.group(1))
        m_avg = re.search(r"Average = (\d+)ms", out)
        if m_avg:
            latency = float(m_avg.group(1))
    else:
        # Unix-like: ", 0% packet loss" and "rtt min/avg/max/mdev = 0.042/0.042/0.042/0.000 ms"
        m_loss = re.search(r"(\d+)% packet loss", out)
        if m_loss:
            packet_loss = float(m_loss.group(1))
        m_rtt = re.search(r"rtt [^=]+= ([0-9./]+) ms", out)
        if m_rtt:
            parts = m_rtt.group(1).split('/')
            if len(parts) >= 2:
                latency = float(parts[1])

    res = {
        'latency_ms': latency,
        'packet_loss': packet_loss,
        'upstream_mbps': None,
        'downstream_mbps': None,
        'raw_output': out
    }
    logger.debug('ISP probe %s -> %s', host, res)
    return res
