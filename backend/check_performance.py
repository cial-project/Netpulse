
import requests
import time

BASE_URL = "http://127.0.0.1:8000/api"
AUTH_URL = f"{BASE_URL}/auth/login/"
KPI_URL = f"{BASE_URL}/dashboard/kpi/"
REALTIME_URL = f"{BASE_URL}/dashboard/real_time_data/"

def check_perf():
    print("Logging in...")
    resp = requests.post(AUTH_URL, json={"username": "admin", "password": "adminpassword"})
    if resp.status_code != 200:
        print("Login failed")
        return
    token = resp.json().get("access")
    headers = {"Authorization": f"Bearer {token}"}

    print("\nMeasuring Response Times:")
    
    # Check KPI
    start = time.time()
    resp = requests.get(KPI_URL, headers=headers)
    end = time.time()
    print(f"KPI Endpoint: {resp.status_code} in {(end-start)*1000:.2f} ms")

    # Check Real-time Data
    start = time.time()
    resp = requests.get(REALTIME_URL, headers=headers)
    end = time.time()
    print(f"Real-time Data Endpoint: {resp.status_code} in {(end-start)*1000:.2f} ms")

if __name__ == "__main__":
    check_perf()
