# NetPulse Deployment Guide

## Overview
This guide will help you deploy NetPulse with:
- **Frontend**: Netlify (Static hosting)
- **Backend**: Render (Django/Daphne server)
- **Database**: Supabase (PostgreSQL)

## Prerequisites
- GitHub account
- Netlify account
- Render account
- Supabase account (already set up ✓)

---

## Step 1: Prepare Your Code

### 1.1 Generate a Secret Key
Run this command to generate a secure Django secret key:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 1.2 Update .gitignore
Make sure your `.gitignore` includes:
```
.env
*.sqlite3
__pycache__/
*.pyc
```

### 1.3 Commit and Push to GitHub
```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

---

## Step 2: Deploy Backend to Render

### 2.1 Create Redis Instance (First)
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New** → **Redis**
3. Name it: `netpulse-redis`
4. Select the **Free** plan
5. Click **Create Redis**
6. Once created, copy the **Internal Redis URL** (looks like `redis://red-xxx:6379`)

### 2.2 Create Web Service
1. Click **New** → **Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `netpulse-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `chmod +x build.sh && ./build.sh`
   - **Start Command**: `daphne -b 0.0.0.0 -p $PORT netpulse.asgi:application`
   - **Plan**: Free

### 2.3 Add Environment Variables
Click **Environment** and add these variables:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://postgres.leltykblaezdrwwkzmuy:R8GrtXf6DpOA2lub@aws-1-ap-south-1.pooler.supabase.com:6543/postgres` |
| `REDIS_URL` | Your Redis Internal URL from step 2.1 |
| `SECRET_KEY` | Your generated secret key from step 1.1 |
| `DEBUG` | `False` |
| `ALLOWED_HOSTS` | `*` (change to specific domain later) |
| `PYTHON_VERSION` | `3.11.0` |

### 2.4 Deploy
Click **Create Web Service** and wait for the build to complete.

### 2.5 Get Your Backend URL
Once deployed, copy your backend URL (e.g., `https://netpulse-backend.onrender.com`)

---

## Step 3: Create Celery Worker (Optional but Recommended)

1. Click **New** → **Background Worker**
2. Connect the same repository
3. Configure:
   - **Name**: `netpulse-worker`
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `celery -A netpulse worker -l info`
4. Add the **same environment variables** as the web service
5. Click **Create Background Worker**

---

## Step 4: Deploy Frontend to Netlify

### 4.1 Update Frontend Configuration
1. Edit `frontend/js/config.js` and replace with your Render backend URL:
```javascript
window.NETPULSE_API_BASE = "https://netpulse-backend.onrender.com";
```

2. Commit and push:
```bash
git add .
git commit -m "Update API URL for production"
git push origin main
```

### 4.2 Deploy to Netlify
1. Go to [Netlify](https://app.netlify.com/)
2. Click **Add new site** → **Import an existing project**
3. Connect to GitHub and select your repository
4. Configure:
   - **Base directory**: `frontend`
   - **Build command**: (leave empty)
   - **Publish directory**: `.`
5. Click **Deploy site**

### 4.3 Get Your Frontend URL
Once deployed, Netlify will give you a URL (e.g., `https://netpulse-xyz.netlify.app`)

---

## Step 5: Update CORS Settings

### 5.1 Update Backend Environment Variables
Go back to your Render backend service and update these variables:

| Key | Value |
|-----|-------|
| `ALLOWED_HOSTS` | `your-backend.onrender.com` |
| `CORS_ALLOW_ALL_ORIGINS` | `False` |
| `CORS_ALLOWED_ORIGINS` | `https://your-frontend.netlify.app` |
| `CSRF_TRUSTED_ORIGINS` | `https://your-frontend.netlify.app,https://your-backend.onrender.com` |

Replace the URLs with your actual URLs.

### 5.2 Trigger Redeploy
Click **Manual Deploy** → **Deploy latest commit**

---

## Step 6: Initialize Database

### 6.1 Connect to Render Shell
1. Go to your Render backend service
2. Click **Shell** (in the top right corner)
3. Run these commands:
```bash
python manage.py migrate
python manage.py createsuperuser
```

Follow the prompts to create an admin user.

---

## Step 7: Test Your Deployment

1. Visit your Netlify URL: `https://your-frontend.netlify.app`
2. Try logging in with your superuser credentials
3. Test adding a device and viewing the dashboard

---

## Troubleshooting

### Build Fails on Render
- Check the build logs for errors
- Ensure `requirements.txt` is complete
- Verify Python version is set correctly

### 502 Bad Gateway
- Check if the backend service is running on Render
- Verify the `DATABASE_URL` is correct
- Check Redis is running and connected

### CORS Errors
- Verify `CORS_ALLOWED_ORIGINS` includes your frontend URL
- Ensure `CSRF_TRUSTED_ORIGINS` is set correctly
- Check browser console for exact error messages

### Database Connection Issues
- Verify Supabase connection string is correct
- Check if Supabase database is active
- Ensure migrations have been run

---

## Optional: Custom Domain

### For Netlify (Frontend)
1. Go to **Domain settings**
2. Click **Add custom domain**
3. Follow the DNS configuration steps

### For Render (Backend)
1. Go to **Settings** → **Custom Domains**
2. Add your domain
3. Update DNS records as instructed

---

## Monitoring and Maintenance

- **Render Logs**: Check backend logs in Render dashboard
- **Netlify Deploy Logs**: View frontend deploy history
- **Supabase**: Monitor database usage and queries
- **Redis**: Keep an eye on memory usage (Free tier has limits)

---

## Cost Summary (Free Tier Limits)

- **Netlify**: 100GB bandwidth/month, 300 build minutes/month
- **Render**: 750 hours/month (keeps services awake ~31 days)
- **Supabase**: 500MB database, 2GB bandwidth/month
- **Redis on Render**: 25MB storage

**Note**: Render free tier services sleep after 15 minutes of inactivity. They wake up automatically when accessed but may take 30-60 seconds.

---

## Next Steps

1. Set up monitoring and alerts
2. Configure backup schedules in Supabase
3. Add custom domains
4. Set up SSL certificates (auto-configured on Netlify/Render)
5. Create deployment pipeline with GitHub Actions

---

**Congratulations! Your NetPulse application is now live! 🚀**
