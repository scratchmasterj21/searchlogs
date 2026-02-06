# Worker Control Panel Setup Guide

This guide will help you set up the Cloudflare Worker Control Panel to manage your search engine backend.

## Prerequisites

- Cloudflare account with Workers enabled
- Wrangler CLI installed (comes with the backend project)

## Step 1: Deploy the Cloudflare Worker

1. **Open terminal** and navigate to the worker directory:
   ```bash
   cd backendgfa-search-engine-v1-backend
   ```

2. **Login to Cloudflare** (if not already logged in):
   ```bash
   npx wrangler login
   ```

3. **Deploy the worker**:
   ```bash
   npx wrangler deploy
   ```

4. **Copy the worker URL** from the deployment output. It will look like:
   ```
   https://backend.YOUR-ACCOUNT-NAME.workers.dev
   ```
   Or if you have a custom domain configured, use that instead.

## Step 2: Configure the Frontend

1. **Navigate to the search_logs directory**:
   ```bash
   cd ../search_logs
   ```

2. **Create a `.env` file** (copy from `.env.example` if it exists):
   ```bash
   cp .env.example .env
   ```

3. **Edit the `.env` file** and add your worker URL:
   ```env
   VITE_WORKER_URL=https://backend.YOUR-ACCOUNT-NAME.workers.dev
   ```
   Replace `YOUR-ACCOUNT-NAME` with your actual Cloudflare account subdomain.

4. **Restart your development server**:
   ```bash
   npm run dev
   ```

## Step 3: Initialize KV Values (Optional)

If you want to set initial values for the worker status, you can do so via the Cloudflare dashboard or wrangler CLI:

```bash
# Set worker status to 'on'
npx wrangler kv:key put --binding=KV_NAMESPACE "worker_status" "on"

# Set AI status to 'on'
npx wrangler kv:key put --binding=KV_NAMESPACE "ai_status" "on"
```

## Step 4: Test the Control Panel

1. **Navigate to the Worker Control Panel** in your browser:
   ```
   http://localhost:5173/worker-control
   ```

2. **Verify the status** is displayed correctly
3. **Try toggling** the worker or AI status
4. **Check the activity log** to see your changes

## Troubleshooting

### "Failed to fetch" Error

- **Cause**: Worker is not deployed or URL is incorrect
- **Solution**: Follow Step 1 and Step 2 above

### "Unauthorized" Error

- **Cause**: Firebase authentication token is missing or invalid
- **Solution**: Make sure you're logged into the search logs admin panel

### Worker URL Not Updating

- **Cause**: Environment variables are cached
- **Solution**: Stop the dev server (Ctrl+C) and restart it with `npm run dev`

### CORS Errors

- **Cause**: The worker is not returning proper CORS headers
- **Solution**: The worker code has been updated with CORS support. Redeploy with `npx wrangler deploy`

## Features

- **Real-time Status**: View current worker and AI service status
- **Toggle Controls**: Enable/disable services independently
- **Bulk Actions**: Enable/disable both services at once
- **Health Monitoring**: Check worker health and response times
- **Service Testing**: Test search and AI chat functionality
- **Activity Logging**: Track all status changes with timestamps and user info
- **Auto-refresh**: Automatically update status every 30 seconds

## Security Notes

- All status updates require Firebase authentication
- Activity logs are stored in Firebase Realtime Database
- The worker validates auth tokens before making changes
- Only authenticated admin users can access the control panel

## Custom Domain (Optional)

If you want to use a custom domain for your worker:

1. Configure a custom domain in Cloudflare Workers settings
2. Update the `.env` file with your custom domain:
   ```env
   VITE_WORKER_URL=https://api.yourdomain.com
   ```
3. Restart the dev server

## Next Steps

- Monitor your worker status regularly
- Check activity logs to track changes
- Set up alerts for when services go offline
- Consider implementing automated health checks
