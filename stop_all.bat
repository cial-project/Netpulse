@echo off
title NetPulse - Stopping All Services
echo ============================================================
echo   NetPulse - Stopping All Services
echo ============================================================
echo.

echo Stopping Celery Beat...
taskkill /FI "WINDOWTITLE eq NetPulse - Celery Beat" /F /T >nul 2>&1

echo Stopping Celery Worker...
taskkill /FI "WINDOWTITLE eq NetPulse - Celery Worker" /F /T >nul 2>&1

echo Stopping Django Server...
taskkill /FI "WINDOWTITLE eq NetPulse - Django" /F /T >nul 2>&1

echo Stopping Redis...
taskkill /FI "WINDOWTITLE eq NetPulse - Redis" /F /T >nul 2>&1

:: Also kill by process name as fallback
taskkill /IM redis-server.exe /F >nul 2>&1
taskkill /IM celery.exe /F >nul 2>&1

echo.
echo All NetPulse services stopped.
pause
