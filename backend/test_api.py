
import requests
import time
import sys

BASE_URL = "http://localhost:8000/api"
AUTH_URL = f"{BASE_URL}/auth/login/"
DEVICES_URL = f"{BASE_URL}/devices/"

def test_api():
    print("Testing API...")
    
    # 1. Login
    print("Logging in...")
    try:
        response = requests.post(AUTH_URL, json={
            "username": "admin",
            "password": "adminpassword"
        })
        if response.status_code != 200:
            print(f"Login failed: {response.text}")
            return
        token = response.json().get("access")
        print("Login successful. Token obtained.")
    except Exception as e:
        print(f"Login exception: {e}")
        return

    headers = {"Authorization": f"Bearer {token}"}

    # 2. Add Device (Real IP)
    print("Adding device with IP 8.8.8.8...")
    device_payload = {
        "name": "Google DNS Test",
        "ip_address": "8.8.8.8",
        "device_type": "router",
        "snmp_community": "public",
        "is_active": True
    }
    
    try:
        response = requests.post(DEVICES_URL, json=device_payload, headers=headers)
        if response.status_code == 201:
            device = response.json()
            print(f"Device added successfully: ID={device['id']}, Name={device['name']}")
            print(f"Initial Status: {device.get('is_online', 'Unknown')}")
            
            # 3. Check Status after wait
            print("Waiting 5 seconds for potential background poll...")
            time.sleep(5)
            
            # Fetch device details
            detail_url = f"{DEVICES_URL}{device['id']}/"
            response = requests.get(detail_url, headers=headers)
            if response.status_code == 200:
                updated_device = response.json()
                print(f"Updated Status: {updated_device.get('is_online', 'Unknown')}")
                if updated_device.get('is_online'):
                    print("SUCCESS: Device is ONLINE (Real IP verification worked!)")
                else:
                    print("NOTE: Device is OFFLINE. (Expected if SNMP is blocked or unavailable on 8.8.8.8)")
            else:
                print(f"Failed to fetch device details: {response.text}")
                
        else:
            print(f"Failed to add device: {response.status_code} {response.text}")
    except Exception as e:
        print(f"Add device exception: {e}")

if __name__ == "__main__":
    test_api()
