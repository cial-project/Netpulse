from rest_framework.decorators import api_view
from rest_framework.response import Response
from .snmp_service import poll_device

@api_view(["GET"])
def device_status(request):
    ip = request.GET.get("ip")
    if not ip:
        return Response({"error": "IP required"}, status=400)
    result = poll_device(ip, "router")
    return Response({"ip": ip, "status": result.get("status", "unknown"), "details": result})
