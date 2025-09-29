from rest_framework.decorators import api_view
from rest_framework.response import Response
from .snmp_service import get_device_status

@api_view(["GET"])
def device_status(request):
    ip = request.GET.get("ip")
    if not ip:
        return Response({"error": "IP required"}, status=400)
    status = get_device_status(ip)
    return Response({"ip": ip, "status": status})
