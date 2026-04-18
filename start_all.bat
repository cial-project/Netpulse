@echo off
title NetPulse - Full Stack Launcher
echo ============================================================
echo   NetPulse Network Monitoring System - Starting All Services
echo ============================================================
echo.

:: Paths
set PROJECT_DIR=%~dp0
set BACKEND_DIR=%PROJECT_DIR%backend
set REDIS_DIR=%PROJECT_DIR%redis
set PYTHON_EXE=%BACKEND_DIR%\venv\Scripts\python.exe
set CELERY_EXE=%BACKEND_DIR%\venv\Scripts\celery.exe

:: 1. Start Redis
echo [1/5] Starting Redis Server...
start "NetPulse - Redis" /MIN "%REDIS_DIR%\redis-server.exe" "%REDIS_DIR%\redis.windows.conf"
timeout /t 2 /nobreak >nul
echo       Redis started on port 6379

:: 2. Run Django migrations (just in case)
echo [2/5] Running Django migrations...
"%PYTHON_EXE%" "%BACKEND_DIR%\manage.py" migrate --run-syncdb >nul 2>&1
echo       Migrations applied

:: 3. Start Celery Worker
echo [3/5] Starting Celery Worker...
start "NetPulse - Celery Worker" /MIN cmd /c "cd /d %BACKEND_DIR% && %CELERY_EXE% -A netpulse worker -l info -P solo"
timeout /t 1 /nobreak >nul
echo       Celery Worker started

:: 4. Start Celery Beat
echo [4/5] Starting Celery Beat...
start "NetPulse - Celery Beat" /MIN cmd /c "cd /d %BACKEND_DIR% && %CELERY_EXE% -A netpulse beat -l info"
timeout /t 1 /nobreak >nul
echo       Celery Beat started (scheduling tasks every 10s)

:: 5. Start Django Server
echo [5/5] Starting Django Server...
start "NetPulse - Django" cmd /c "cd /d %BACKEND_DIR% && %PYTHON_EXE% manage.py runserver 127.0.0.1:8000"
timeout /t 2 /nobreak >nul
echo       Django running at http://127.0.0.1:8000

echo.
echo ============================================================
echo   All services started successfully!
echo.
echo   Dashboard:  Open frontend\login.html in your browser
echo               or run:  cd netpulse-desktop && npm start
echo.
echo   To stop all services, close this window and all
echo   minimized terminal windows, or run stop_all.bat
echo ============================================================
echo.
pause
