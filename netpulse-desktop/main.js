const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

// Track all child processes so we can clean up on exit
let redisProcess = null;
let djangoProcess = null;
let celeryWorkerProcess = null;
let celeryBeatProcess = null;

const backendDir = path.join(__dirname, '..', 'backend');
const redisDir   = path.join(__dirname, '..', 'redis');
const pythonExe  = path.join(backendDir, 'venv', 'Scripts', 'python.exe');
const celeryExe  = path.join(backendDir, 'venv', 'Scripts', 'celery.exe');

const commonEnv = {
    ...process.env,
    DJANGO_SETTINGS_MODULE: 'netpulse.settings',
    PYTHONPATH: backendDir
};

// ---------------------------------------------------------------------------
// Utility: wait for a TCP server to be reachable
// ---------------------------------------------------------------------------
function waitForServer(url, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;
        const check = () => {
            if (Date.now() > deadline) {
                return reject(new Error(`Server at ${url} did not start within ${timeoutMs}ms`));
            }
            http.get(url, () => resolve()).on('error', () => setTimeout(check, 500));
        };
        check();
    });
}

// ---------------------------------------------------------------------------
// 1. Start Redis (portable, bundled in project)
// ---------------------------------------------------------------------------
function startRedis() {
    const redisExe  = path.join(redisDir, 'redis-server.exe');
    const redisConf = path.join(redisDir, 'redis.windows.conf');

    redisProcess = spawn(redisExe, [redisConf], {
        cwd: redisDir,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    redisProcess.stdout.on('data', (d) => console.log(`[Redis] ${d}`));
    redisProcess.stderr.on('data', (d) => console.error(`[Redis] ${d}`));
    redisProcess.on('error', (err) => console.error('[Redis] Failed to start:', err.message));
    console.log('[Electron] Redis started (PID:', redisProcess.pid, ')');
}

// ---------------------------------------------------------------------------
// 2. Start Django dev server
// ---------------------------------------------------------------------------
function startDjango() {
    djangoProcess = spawn(pythonExe, ['manage.py', 'runserver', '127.0.0.1:8000', '--noreload'], {
        cwd: backendDir,
        detached: true,
        env: commonEnv,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    djangoProcess.stdout.on('data', (d) => console.log(`[Django] ${d}`));
    djangoProcess.stderr.on('data', (d) => console.error(`[Django] ${d}`));
    djangoProcess.on('error', (err) => console.error('[Django] Failed to start:', err.message));
    console.log('[Electron] Django started (PID:', djangoProcess.pid, ')');
}

// ---------------------------------------------------------------------------
// 3. Start Celery Worker (executes tasks from Redis queue)
// ---------------------------------------------------------------------------
function startCeleryWorker() {
    celeryWorkerProcess = spawn(celeryExe, ['-A', 'netpulse', 'worker', '-l', 'info', '-P', 'solo', '--without-heartbeat'], {
        cwd: backendDir,
        detached: true,
        env: commonEnv,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    celeryWorkerProcess.stdout.on('data', (d) => console.log(`[Celery-W] ${d}`));
    celeryWorkerProcess.stderr.on('data', (d) => console.error(`[Celery-W] ${d}`));
    celeryWorkerProcess.on('error', (err) => console.error('[Celery Worker] Failed to start:', err.message));
    console.log('[Electron] Celery Worker started (PID:', celeryWorkerProcess.pid, ')');
}

// ---------------------------------------------------------------------------
// 4. Start Celery Beat (schedules periodic tasks)
// ---------------------------------------------------------------------------
function startCeleryBeat() {
    celeryBeatProcess = spawn(celeryExe, ['-A', 'netpulse', 'beat', '-l', 'info', '--schedule', path.join(backendDir, 'celerybeat-schedule')], {
        cwd: backendDir,
        detached: true,
        env: commonEnv,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    celeryBeatProcess.stdout.on('data', (d) => console.log(`[Celery-B] ${d}`));
    celeryBeatProcess.stderr.on('data', (d) => console.error(`[Celery-B] ${d}`));
    celeryBeatProcess.on('error', (err) => console.error('[Celery Beat] Failed to start:', err.message));
    console.log('[Electron] Celery Beat started (PID:', celeryBeatProcess.pid, ')');
}

// ---------------------------------------------------------------------------
// Create Electron window after all services are up
// ---------------------------------------------------------------------------
function createWindow() {
    const win = new BrowserWindow({
        width: 1440,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true
        }
    });

    // Launch services in order: Redis → Django + Celery → wait → load UI
    startRedis();

    // Give Redis 1.5 s to bind, then start Django and Celery
    setTimeout(() => {
        startDjango();
        startCeleryWorker();
        startCeleryBeat();

        // Wait for Django to be ready, then show the login page
        waitForServer('http://127.0.0.1:8000')
            .then(() => {
                console.log('[Electron] Django is ready — loading UI');
                win.loadFile(path.join(__dirname, '..', 'frontend', 'login.html'));
            })
            .catch((err) => {
                console.error('[Electron]', err.message);
                win.loadFile(path.join(__dirname, '..', 'frontend', 'login.html'));
            });
    }, 1500);
}

// ---------------------------------------------------------------------------
// Cleanup: kill all child processes on quit
// ---------------------------------------------------------------------------
function killAll() {
    const procs = [
        { name: 'Celery Beat',   p: celeryBeatProcess },
        { name: 'Celery Worker', p: celeryWorkerProcess },
        { name: 'Django',        p: djangoProcess },
        { name: 'Redis',         p: redisProcess },
    ];
    for (const { name, p } of procs) {
        if (p && !p.killed) {
            try {
                // On Windows, taskkill /T /F kills the entire process tree
                spawn('taskkill', ['/pid', String(p.pid), '/f', '/t'], { stdio: 'ignore' });
                console.log(`[Electron] Killed ${name} (PID: ${p.pid})`);
            } catch (e) {
                console.error(`[Electron] Failed to kill ${name}:`, e.message);
            }
        }
    }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    killAll();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    killAll();
});
