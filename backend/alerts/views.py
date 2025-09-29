from rest_framework.decorators import api_view
from rest_framework.response import Response

alerts_db = []  # temporary in-memory store

@api_view(["POST"])
def create_alert(request):
    msg = request.data.get("message")
    alerts_db.append(msg)
    return Response({"success": True, "alerts": alerts_db})

@api_view(["GET"])
def list_alerts(request):
    return Response({"alerts": alerts_db})
