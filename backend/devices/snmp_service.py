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
                    'memory_usage': 0.0,
                    'network_in': 0.0,
                    'network_out': 0.0,
                    'temperature': snmp_result.get('temperature'),
                }

                # Persist a Metric if Device model available and device exists
                try:
                    if Device:
                        dev = Device.objects.filter(ip_address=ip).first()
                        if dev:
                            Metric.objects.create(
                                device=dev,
                                cpu_usage=float(result.get('cpu_usage') or 0.0),
                                memory_usage=float(result.get('memory_usage') or 0.0),
                                network_in=float(result.get('network_in') or 0.0),
                                network_out=float(result.get('network_out') or 0.0),
                                temperature=result.get('temperature'),
                            )
                except Exception:
                    logger.exception('Failed to save Metric for %s', ip)

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
            # SNMP read failed — fall back to simulator below
            logger.debug('SNMP poll failed for %s, falling back to simulator', ip)

    # Simulator fallback
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

    # Try to get CPU load from HOST-RESOURCES-MIB (hrProcessorLoad) — take first entry if present
    try:
        # walk hrProcessorLoad table
        cpu_load = None
        for (errorIndication, errorStatus, errorIndex, varBinds) in nextCmd(
            SnmpEngine(),
            community_data,
            target,
            ContextData(),
            ObjectType(ObjectIdentity('1.3.6.1.2.1.25.3.3.1.2')),
            lexicographicMode=False,
        ):
            if errorIndication or errorStatus:
                break
            for vb in varBinds:
                try:
                    cpu_load = float(vb[1])
                    break
                except Exception:
                    continue
            if cpu_load is not None:
                break
        if cpu_load is not None:
            result['cpu_load'] = cpu_load
    except Exception:
        logger.debug('Failed to read CPU load for %s', ip)

    # Temperature OID is vendor specific. Try a couple of common ones (UCD-SNMP-MIB::extOutput or similar) - skip if not found
    # For simplicity, we won't try many vendor OIDs here.

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