# Vercel Deployment Guide

## Problem
Google OAuth was redirecting to `localhost:5174` on Vercel because environment variables were hardcoded to localhost in the code.

## Solution Implemented
The code now **dynamically detects URLs** from request headers (x-forwarded-host, x-forwarded-proto) so it works on any deployment domain.

## Vercel Setup Instructions

### 1. Deploy Frontend + Backend Together (Recommended)

If deploying as a monorepo:

```bash
vercel deploy
```

### 2. Deploy Backend Separately (Alternative)

If you want to separate frontend and backend:

**Backend Deployment (Vercel Functions):**
- Create a separate Vercel project for `server/api.js`
- Set environment variables in Vercel Project Settings:
  - `GOOGLE_CLIENT_ID`: [from Google Cloud Console]
  - `GOOGLE_CLIENT_SECRET`: [from Google Cloud Console]
  - `JWT_SECRET`: [generate with: `openssl rand -hex 32`]
  - `DATABASE_URL`: [your NeonDB connection string]
  - `NODE_ENV`: `production`

**Frontend Deployment (Vite):**
- Set in Vercel Project Settings:
  - `VITE_API_URL`: `https://your-backend-url.vercel.app` (if backend is separate)
  - Leave blank to auto-detect from same domain

### 3. Google Cloud Console Updates

Add your Vercel URL to authorized redirect URIs:

```
https://your-app.vercel.app/auth/google/callback
```

Also update locally for testing:
```
http://localhost:3001/auth/google/callback
```

### 4. Environment Variables for Vercel

In Vercel Project Settings → Environment Variables, add:

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret  
JWT_SECRET=your_jwt_secret
DATABASE_URL=your_neon_connection_string
NODE_ENV=production
```

Leave these BLANK in Vercel (they auto-detect):
- `FRONTEND_URL` (auto-detected from request headers)
- `API_URL` (auto-detected or uses FRONTEND_URL)
- `VITE_API_URL` (frontend auto-detects at runtime)

### 5. How It Works Now

**On localhost:**
- `.env` file has explicit localhost URLs
- Everything works as before

**On Vercel:**
- `FRONTEND_URL` is auto-detected from `x-forwarded-host` header → `https://your-app.vercel.app`
- `API_URL` defaults to same domain
- Frontend dynamically detects API URL from window.location
- **Result:** OAuth redirects to correct Vercel URL, not localhost ✅

### 6. Testing

1. Deploy to Vercel
2. Visit your Vercel URL: `https://your-app.vercel.app`
3. Click "Sign in with Google"
4. After authentication, you should redirect to `/workspaces` (not localhost)

## Troubleshooting

**Issue:** Still redirecting to localhost
- Check Vercel logs: `vercel logs`
- Verify `GOOGLE_CALLBACK_URL` is set correctly in Google Cloud Console
- Check that `NODE_ENV` is set to `production` in Vercel

**Issue:** "Invalid redirect_uri"
- Ensure the URL in Google Cloud Console exactly matches your Vercel deployment URL
- Google is very strict about this matching

**Issue:** 401 errors on API calls
- Verify `JWT_SECRET` is the same on both frontend and backend
- Check that `DATABASE_URL` is set in Vercel environment
