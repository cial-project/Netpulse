# Render Environment Variables

## Copy these exact values when setting up your Render Web Service

### Required Variables

```
DATABASE_URL
postgresql://postgres.leltykblaezdrwwkzmuy:R8GrtXf6DpOA2lub@aws-1-ap-south-1.pooler.supabase.com:6543/postgres

SECRET_KEY
xv*k7c_23bendiwpt*i-ez7#r$!oq@eqeprm1qzx!%1%j+fo5^

DEBUG
False

ALLOWED_HOSTS
*

PYTHON_VERSION
3.11.0
```

### After Creating Redis Instance

Once you create your Redis instance on Render, add this variable with your Redis URL:

```
REDIS_URL
redis://red-xxxxx:6379
```
(Replace with your actual Redis Internal URL from Render)

### After Deploying Frontend to Netlify

Once your frontend is deployed, update these variables:

```
ALLOWED_HOSTS
your-backend.onrender.com

CORS_ALLOW_ALL_ORIGINS
False

CORS_ALLOWED_ORIGINS
https://your-frontend.netlify.app

CSRF_TRUSTED_ORIGINS
https://your-frontend.netlify.app,https://your-backend.onrender.com
```

---

## Quick Setup Checklist

### ✅ Step 1: Create Redis on Render
1. New → Redis
2. Name: `netpulse-redis`
3. Plan: Free
4. Copy the **Internal Redis URL**

### ✅ Step 2: Create Web Service on Render
1. New → Web Service
2. Connect GitHub repo
3. Configuration:
   - Root Directory: `backend`
   - Build Command: `chmod +x build.sh && ./build.sh`
   - Start Command: `daphne -b 0.0.0.0 -p $PORT netpulse.asgi:application`
   - Plan: Free

### ✅ Step 3: Add Environment Variables
Copy-paste the variables from the "Required Variables" section above

### ✅ Step 4: Add Redis URL
After Redis is created, add the `REDIS_URL` variable

### ✅ Step 5: Deploy
Click "Create Web Service" and wait for deployment

### ✅ Step 6: Get Backend URL
Copy your backend URL (e.g., `https://netpulse-backend.onrender.com`)

### ✅ Step 7: Update frontend/js/config.js
```javascript
window.NETPULSE_API_BASE = "https://YOUR-BACKEND-URL.onrender.com";
```

### ✅ Step 8: Deploy to Netlify
1. New site from Git
2. Base directory: `frontend`
3. Build command: (empty)
4. Publish directory: `.`

### ✅ Step 9: Update CORS Settings on Render
Add the remaining environment variables with your actual Netlify URL

### ✅ Step 10: Initialize Database
Use Render Shell:
```bash
python manage.py migrate
python manage.py createsuperuser
```

---

**Your credentials are ready for deployment! 🚀**
