# Railway Deployment Guide

This guide will help you deploy the Dixa-Voyado Webhook Service to Railway.

## Prerequisites

- GitHub account
- Railway account
- Voyado API key

## Step 1: Push to GitHub

1. **Initialize Git repository** (if not already done):

   ```bash
   git init
   git add .
   git commit -m "Initial commit: Dixa-Voyado webhook service"
   ```

2. **Create a new repository on GitHub** and push your code:
   ```bash
   git remote add origin https://github.com/yourusername/dixa-voyado-service.git
   git branch -M main
   git push -u origin main
   ```

## Step 2: Deploy to Railway

1. **Go to [Railway.app](https://railway.app)** and sign in
2. **Click "New Project"**
3. **Select "Deploy from GitHub repo"**
4. **Choose your repository**: `dixa-voyado-service`
5. **Click "Deploy"**

## Step 3: Configure Environment Variables

In your Railway project dashboard:

1. **Go to "Variables" tab**
2. **Add the following environment variables**:

   ```
   VOYADO_API_KEY=8a0cee25-5594-44ad-8552-9ed7bac144d2
   VOYADO_API_BASE_URL=https://dixa.staging.voyado.com/api/v3
   ```

3. **Click "Add"** for each variable

## Step 4: Deploy

1. **Railway will automatically build and deploy** your service
2. **Wait for the build to complete** (usually 2-3 minutes)
3. **Check the deployment logs** for any errors

## Step 5: Get Your Webhook URLs

Once deployed, Railway will provide you with a domain like:
`https://your-app-name.railway.app`

Your webhook endpoints will be:

- **Dixa CSAT**: `https://your-app-name.railway.app/webhook/dixa/csat`
- **Voyado Points**: `https://your-app-name.railway.app/webhook/voyado/points`
- **Health Check**: `https://your-app-name.railway.app/health`

## Step 6: Configure Dixa Webhooks

1. **In Dixa**, go to webhook settings
2. **Add a new webhook** with URL: `https://your-app-name.railway.app/webhook/dixa/csat`
3. **Select event type**: `CONVERSATION_RATED`
4. **Save the webhook**

## Step 7: Configure Voyado Webhooks

1. **In Voyado**, configure webhooks to send to: `https://your-app-name.railway.app/webhook/voyado/points`
2. **Select event type**: `point.balance.updated`

## Monitoring

- **Check Railway dashboard** for deployment status
- **View logs** in Railway for debugging
- **Monitor health endpoint** at `/health`
- **Check latest CSAT events** at `/latest-csat`

## Troubleshooting

### Common Issues:

1. **Build fails**: Check that all dependencies are in `package.json`
2. **Environment variables not set**: Verify in Railway Variables tab
3. **Port binding errors**: Railway automatically sets PORT environment variable
4. **Webhook not receiving**: Check Railway logs and webhook configuration
5. **npm start errors**: The service now includes multiple startup methods (Procfile, start.sh, and direct node command)

### Useful Commands:

```bash
# Check Railway logs
railway logs

# Check service status
railway status

# View environment variables
railway variables
```

## Support

If you encounter issues:

1. Check Railway deployment logs
2. Verify environment variables are set correctly
3. Test the health endpoint: `/health`
4. Check webhook configurations in Dixa and Voyado

### Troubleshooting npm start errors

If you see errors like:
```
npm error path /app
npm error command failed
npm error signal SIGTERM
```

**Solutions:**
1. **Railway will automatically use the Procfile** - no action needed
2. **Check that all files are committed** to GitHub
3. **Verify the railway.json** is in your repository
4. **Ensure start.sh is executable** (should be committed as executable)
5. **Try redeploying** - Railway will use the new configuration

The service now includes multiple startup methods:
- **Procfile** (Railway's preferred method)
- **start.sh script** (with debugging output)
- **Direct node command** (fallback)
