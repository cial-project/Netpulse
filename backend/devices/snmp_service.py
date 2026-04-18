import random
from typing import Dict
import logging
from datetime import datetime, timedelta

# Try to import pysnmp; if not available we will keep using the simulator-only behaviour
try:
    from pysnmp.hlapi import (
        SnmpEngine,
        CommunityData,
        UdpTransportTarget,
        ContextData,
        ObjectType,
        ObjectIdentity,
        getCmd,
        nextCmd,
    )
    _HAS_PYSNMP = True
except Exception:
    _HAS_PYSNMP = False

logger = logging.getLogger(__name__)

# State management removed

def poll_device(ip: str, device_type: str, community: str = 'public', port: int = 161, custom_oids: str = '') -> Dict:
    """Complete device polling with enhanced demo data"""
    # Prefer real SNMP polling when pysnmp is available
    if _HAS_PYSNMP:
        try:
            from api.models import Device, Metric
        except Exception:
            Device = None

        # Try a lightweight SNMP poll (sysName, sysLocation, uptime, cpu)
        try:
            # Parse custom_oids: allow JSON dict or newline-separated values
            parsed_oids = []
            if custom_oids:
                try:
                    import json as _json
                    if custom_oids.strip().startswith('{'):
                        obj = _json.loads(custom_oids)
                        # If it's a mapping of key:oid, keep values
                        if isinstance(obj, dict):
                            parsed_oids = list(obj.values())
                    else:
                        parsed_oids = [line.strip() for line in custom_oids.splitlines() if line.strip()]
                except Exception:
                    parsed_oids = [line.strip() for line in custom_oids.splitlines() if line.strip()]

            snmp_result = _snmp_poll_basic(ip, community, port)
            if snmp_result.get('reachable'):
                # Map snmp_result to the expected result shape
                result = {
                    'status': 'up',
                    'reachable': True,
                    'sys_name': snmp_result.get('sysName') or f"Device-{ip}",
                    'uptime_days': round(snmp_result.get('uptime_seconds', 0) / 86400.0, 2),
                    'cpu_usage': snmp_result.get('cpu_load', 0.0),
                    'memory_usage': snmp_result.get('memory_usage', 0.0),
                    'bytes_in': snmp_result.get('bytes_in', 0),
                    'bytes_out': snmp_result.get('bytes_out', 0),
                    'temperature': snmp_result.get('temperature'),
                }

                # If pysnmp available and parsed_oids present, attempt to read them and include in result
                if _HAS_PYSNMP and parsed_oids:
                    try:
                        extra = {}
                        for oid in parsed_oids:
                            # Attempt a single GET for each OID
                            try:
                                errorIndication, errorStatus, errorIndex, varBinds = next(
                                    getCmd(
                                        SnmpEngine(),
                                        CommunityData(community, mpModel=1),
                                        UdpTransportTarget((ip, port), timeout=2, retries=1),
                                        ContextData(),
                                        ObjectType(ObjectIdentity(oid)),
                                    )
                                )
                                if not errorIndication and not errorStatus and varBinds:
                                    for vb in varBinds:
                                        extra[str(vb[0])] = str(vb[1].prettyPrint())
                            except Exception:
                                continue
                        if extra:
                            result['extra'] = extra
                    except Exception:
                        logger.exception('Failed to read custom OIDs for %s', ip)

                return result
        except Exception:
            # SNMP read failed — fall back to ping below
            logger.debug('SNMP poll failed for %s', ip)

    # Ping fallback
    import subprocess
    import platform
    
    param = '-n' if platform.system().lower() == 'windows' else '-c'
    timeout_param = '-w' if platform.system().lower() == 'windows' else '-W'
    # Windows timeout is in ms, Linux is in seconds
    timeout_val = '2000' if platform.system().lower() == 'windows' else '2'
    command = ['ping', param, '1', timeout_param, timeout_val, ip]
    
    is_pingable = False
    try:
        is_pingable = subprocess.call(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0
    except Exception as e:
        logger.debug('Ping failed to execute for %s: %s', ip, e)
        is_pingable = False

    if is_pingable:
        return {
            'status': 'up',
            'reachable': True,
            'sys_name': f"Device-{ip}",
            'uptime_days': 0,
            'cpu_usage': 0.0,
            'memory_usage': 0.0,
            'network_in': 0.0,
            'network_out': 0.0,
            'temperature': None,
        }

    # All real polling failed — fall back to down state (No simulator!)
    return {
        'status': 'down',
        'reachable': False,
        'sys_name': f"Device-{ip}",
        'uptime_days': 0,
        'cpu_usage': 0.0,
        'memory_usage': 0.0,
        'network_in': 0.0,
        'network_out': 0.0,
        'temperature': None,
        'simulator_fallback': False
    }


def _snmp_poll_basic(ip: str, community: str = 'public', port: int = 161, timeout: int = 2):
    """Perform a minimal SNMP poll using pysnmp and return a dict.

    Returns a dict with keys: reachable (bool), sysName, sysLocation, uptime_seconds, cpu_load, temperature
    """
    if not _HAS_PYSNMP:
        raise RuntimeError('pysnmp not available')

    result = {'reachable': False}

    target = UdpTransportTarget((ip, port), timeout=timeout, retries=1)
    community_data = CommunityData(community, mpModel=1)  # SNMP v2c

    # OIDs to read
    sysName_oid = ObjectIdentity('1.3.6.1.2.1.1.5.0')
    sysLocation_oid = ObjectIdentity('1.3.6.1.2.1.1.6.0')
    sysUpTime_oid = ObjectIdentity('1.3.6.1.2.1.1.3.0')

    # Do a multi-get for the basic OIDs
    errorIndication, errorStatus, errorIndex, varBinds = next(
        getCmd(
            SnmpEngine(),
            community_data,
            target,
            ContextData(),
            ObjectType(sysName_oid),
            ObjectType(sysLocation_oid),
            ObjectType(sysUpTime_oid),
        )
    )

    if errorIndication:
        logger.debug('SNMP errorIndication for %s: %s', ip, errorIndication)
        return result

    if errorStatus:
        logger.debug('SNMP errorStatus for %s: %s at %s', ip, errorStatus.prettyPrint(), errorIndex)
        return result

    # Parse varBinds
    for varBind in varBinds:
        oid, val = varBind
        oid_str = str(oid)
        if oid_str.endswith('.1.3.6.1.2.1.1.5.0') or oid_str.endswith('.1.3.6.1.2.1.1.5.0'):
            result['sysName'] = str(val.prettyPrint())
        elif oid_str.endswith('.1.3.6.1.2.1.1.6.0'):
            result['sysLocation'] = str(val.prettyPrint())
        elif oid_str.endswith('.1.3.6.1.2.1.1.3.0'):
            # sysUpTime is in hundredths of seconds
            try:
                ticks = int(val)
                result['uptime_seconds'] = ticks / 100.0
            except Exception:
                result['uptime_seconds'] = 0

    result['reachable'] = True

    # Phase 2 OIDs for CPU and Memory
    try:
        cpu_oid = ObjectIdentity('1.3.6.1.4.1.2021.11.9.0')
        mem_oid = ObjectIdentity('1.3.6.1.4.1.2021.4.6.0')
        err1, err2, err3, vb_cm = next(
            getCmd(SnmpEngine(), community_data, target, ContextData(), ObjectType(cpu_oid), ObjectType(mem_oid))
        )
        if not err1 and not err2:
            for vb in vb_cm:
                oid_str = str(vb[0])
                try:
                    if '2021.11.9.0' in oid_str:
                        result['cpu_load'] = float(vb[1])
                    elif '2021.4.6.0' in oid_str:
                        result['memory_usage'] = float(vb[1]) / 1024.0 # KB -> MB
                except Exception:
                    pass
    except Exception:
        pass

    # Phase 2 OIDs for Bandwidth Counters
    bytes_in = 0
    try:
        for (err1, err2, err3, vb_in) in nextCmd(SnmpEngine(), community_data, target, ContextData(), ObjectType(ObjectIdentity('1.3.6.1.2.1.2.2.1.10')), lexicographicMode=False):
            if not err1 and not err2:
                for vb in vb_in:
                    try: bytes_in += int(vb[1])
                    except: pass
    except Exception:
        pass
        
    bytes_out = 0
    try:
        for (err1, err2, err3, vb_out) in nextCmd(SnmpEngine(), community_data, target, ContextData(), ObjectType(ObjectIdentity('1.3.6.1.2.1.2.2.1.16')), lexicographicMode=False):
            if not err1 and not err2:
                for vb in vb_out:
                    try: bytes_out += int(vb[1])
                    except: pass
    except Exception:
        pass
        
    result['bytes_in'] = bytes_in
    result['bytes_out'] = bytes_out

    return result

def get_device_metrics_trend(ip: str, hours: int = 24):
    """Get realistic metric trends from database"""
    try:
        from api.models import Device, Metric
        device = Device.objects.filter(ip_address=ip).first()
        if not device:
            return []
            
        now = datetime.now()
        cutoff = now - timedelta(hours=hours)
        metrics = Metric.objects.filter(device=device, timestamp__gte=cutoff).order_by('timestamp')
        
        trends = []
        for m in metrics:
            trends.append({
                'timestamp': m.timestamp.isoformat(),
                'cpu_usage': m.cpu_usage,
                'network_in': m.network_in,
                'network_out': m.network_out
            })
        return trends
    except Exception as e:
        logger.error(f"Error fetching trends: {e}")
        return []