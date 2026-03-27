# Vercel Deployment Checklist ✅

## Pre-Deployment (Local Testing)

- [ ] Node.js installed and tested
- [ ] `npm install` completed without errors
- [ ] `.env` file created with all variables
- [ ] `npm run dev` starts without errors
- [ ] Test: `curl http://localhost:3000/` returns 200
- [ ] Test webhook health: `curl http://localhost:3000/api/webhook/ping`
- [ ] MongoDB connection string validated
- [ ] Groq API key tested
- [ ] 11za credentials obtained

## Environment Variables Needed

Copy these to Vercel Dashboard (Project → Settings → Environment Variables):

```
WHATSAPP_API_URL=https://internal.11za.in/apis
WHATSAPP_API_TOKEN=<your_11za_token>
ELEVENZA_WEBHOOK_SECRET=<your_webhook_secret>
ORIGIN_WEBSITE=<your_vercel_domain>
MONGODB_URI=<your_mongodb_connection_string>
DB_NAME=lifeos
GROQ_API_KEY=<your_groq_api_key>
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DEFAULT_TIMEZONE=Asia/Kolkata
LOG_LEVEL=info
```

## Step 1: Prepare Code for Deployment

```bash
# Ensure all files are committed
git add .
git commit -m "Setup LifeOS for Vercel deployment"
git push origin main
```

## Step 2: Connect to Vercel

### Option A: Using Vercel CLI
```bash
npm i -g vercel
vercel
# Follow prompts to connect GitHub repo
```

### Option B: Using Vercel Dashboard
1. Go to https://vercel.com
2. Sign in with GitHub
3. Select repository
4. Click "Import"

## Step 3: Configure Environment Variables

In Vercel Dashboard:
1. Project → Settings → Environment Variables
2. Add all variables from "Environment Variables Needed" section
3. Set to "Production"
4. Redeploy after adding variables

## Step 4: Verify Deployment

```bash
# After deployment completes:
curl https://<your-project>.vercel.app/
# Should return: "LifeOS API is running"

curl https://<your-project>.vercel.app/api/health
# Should return health status

curl https://<your-project>.vercel.app/api/webhook/ping
# Should return: "Webhook endpoint is accessible"
```

## Step 5: Configure 11za Webhook

1. Log in to 11za dashboard
2. Settings → Webhooks or API Configuration
3. Set webhook URL: `https://<your-project>.vercel.app/api/webhook/whatsapp`
4. Set API Key: `<your_ELEVENZA_WEBHOOK_SECRET>`
5. Test webhook connection
6. Save

## Step 6: Initial Testing

### Via WhatsApp:
1. Send any message to your WhatsApp bot number
2. Should receive: Welcome message with first onboarding question
3. Reply with your name
4. Continue through onboarding
5. After onboarding: "Set reminder for gym at 3 PM"
6. Confirm reminder was created
7. Test: "Log activity - completed yoga"

### Via Curl:
```bash
# Test webhook
curl -X POST https://<your-project>.vercel.app/api/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_webhook_secret" \
  -d '{
    "from": "+919999999999",
    "content": {
      "contentType": "text",
      "text": "Hi there"
    }
  }'
```

## Step 7: Monitor Deployment

```bash
# Check logs
vercel logs <project-url>

# Continuous logs
vercel logs <project-url> --follow
```

## Step 8: Database Verification

Check MongoDB Atlas:
1. Go to your cluster
2. Collections should have:
   - Users (new user created after first message)
   - Reminders (after creating reminder)
   - Activities (after logging activity)
   - Conversations (chat history)

## Common Deployment Issues

### Issue: Webhook returns 500
**Solution:**
- Check Vercel logs: `vercel logs`
- Verify all environment variables set
- Ensure MONGODB_URI is correct
- Check GROQ_API_KEY is valid

### Issue: WhatsApp not receiving messages
**Solution:**
- Verify webhook URL in 11za dashboard
- Check API key matches ELEVENZA_WEBHOOK_SECRET
- Test with curl first
- Check Vercel function logs

### Issue: Database connection timeout
**Solution:**
- Whitelist Vercel IPs in MongoDB Atlas
- MongoDB Atlas → Security → IP Whitelist → Add 0.0.0.0/0
- (Or specific Vercel IP ranges)

### Issue: Reminders not triggering
**Solution:**
- This is normal on Vercel initially
- Reminders check when user sends message
- Send a message and reminders should trigger
- For scheduled reminders, use local server with cron

## Rollback Deployment

```bash
# List deployments
vercel ls

# Rollback to previous
vercel rollback

# Or redeploy specific commit
git checkout <commit-hash>
git push origin main
vercel --prod
```

## Performance Optimization

1. **Max Package Size**: Vercel limit is 50MB
   - Check: `du -sh node_modules/`
   - If > 40MB, consider optimizing dependencies

2. **Cold Start Optimization**: Current setup is optimized
   - OnDemandScheduler reduces unnecessary initialization
   - Database only connects on first request

3. **Timeout Limits**: Vercel free tier has limits
   - Default: 60 seconds
   - Pro required for longer functions
   - Current setup completes under 5 seconds typically

## Monitoring Setup (Optional)

### Using Vercel Analytics
1. Vercel Dashboard → Analytics
2. Monitor function executions
3. Check error rates
4. Monitor response times

### Using External Monitoring (Recommended)
1. Sentry (Error tracking)
2. LogRocket (Session replay)
3. DataDog (Full monitoring)

## Security Checklist

- [ ] ELEVENZA_WEBHOOK_SECRET is secure (not in code)
- [ ] Environment variables never logged
- [ ] MongoDB credentials never exposed
- [ ] Groq API key never logged
- [ ] All sensitive data in .env
- [ ] No hardcoded tokens in code
- [ ] Webhook signature verification enabled

## Maintenance

### Weekly:
- [ ] Check Vercel usage
- [ ] Review error logs
- [ ] Monitor database growth

### Monthly:
- [ ] Update dependencies: `npm update`
- [ ] Review and clean MongoDB
- [ ] Check Groq API usage

### Quarterly:
- [ ] Implement new features
- [ ] Performance optimization
- [ ] Security audit

## Useful Commands

```bash
# Check deployment status
vercel status

# View production deployment URL
vercel env ls

# Redeploy production
vercel --prod

# View function logs real-time
vercel logs --follow

# List all deployments
vercel ls

# View specific deployment
vercel inspect <url>
```

## Success Criteria ✅

- [ ] Vercel deployment URL accessible
- [ ] Health endpoints return 200
- [ ] Webhook accepts POST requests
- [ ] WhatsApp integration working
- [ ] Onboarding flow completes
- [ ] Reminders created and stored
- [ ] Activities logged
- [ ] Messages processed in < 5 seconds
- [ ] No 5XX errors in logs
- [ ] Database connected on first request

---

Once all items are checked, your LifeOS WhatsApp AI is production-ready! 🚀
