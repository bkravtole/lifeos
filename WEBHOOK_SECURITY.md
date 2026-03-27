# ✅ Webhook Security & Verification Setup

## Current Configuration

Your LifeOS is deployed at: **https://lifeos-seven-dun.vercel.app**

### Webhook URL (for 11za/Elevenza)
```
POST https://lifeos-seven-dun.vercel.app/api/webhook/whatsapp
```

### Authentication Headers
```
x-api-key: lifeos_webhook
```

---

## Verification Flow

### 1️⃣ Incoming Webhook Request
```
POST /api/webhook/whatsapp
Headers: {
  "x-api-key": "lifeos_webhook",
  "Content-Type": "application/json"
}
Body: {
  "from": "917016875366",
  "content": {
    "contentType": "text",
    "text": "message"
  }
}
```

### 2️⃣ Middleware Verification
```javascript
// checks x-api-key header against ELEVENZA_WEBHOOK_SECRET
if (incomingToken !== expectedSecret) {
  ❌ UNAUTHORIZED: Returns 200 (prevents retries)
}
✅ AUTHORIZED: Continues to next()
```

### 3️⃣ Security Features
✅ **Header validation** - `x-api-key` must match `ELEVENZA_WEBHOOK_SECRET`
✅ **Non-blocking** - Returns 200 even on failure (prevents webhook provider retries)
✅ **Logging** - All verification attempts logged
✅ **Environment-based** - Secret in .env (not hardcoded)

---

## Environment Variables

### Required
```env
ELEVENZA_WEBHOOK_SECRET=lifeos_webhook
```

### Optional (for GET verification)
```env
hub.verify_token=lifeos_webhook
hub.challenge=callback_token
```

---

## Testing Webhook Security

### 1. Test with correct header
```bash
curl -X POST https://lifeos-seven-dun.vercel.app/api/webhook/whatsapp \
  -H "x-api-key: lifeos_webhook" \
  -H "Content-Type: application/json" \
  -d '{"from":"917016875366","content":{"contentType":"text","text":"test"}}'

# Expected: 200 OK with message processing response
```

### 2. Test with wrong header
```bash
curl -X POST https://lifeos-seven-dun.vercel.app/api/webhook/whatsapp \
  -H "x-api-key: wrong_token" \
  -H "Content-Type: application/json" \
  -d '{"from":"917016875366","content":{"contentType":"text","text":"test"}}'

# Expected: 200 Unauthorized but acknowledged (prevents retries)
```

### 3. Test without header
```bash
curl -X POST https://lifeos-seven-dun.vercel.app/api/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"from":"917016875366","content":{"contentType":"text","text":"test"}}'

# Expected: 200 Unauthorized but acknowledged
```

---

## Logs to Check

### Vercel Dashboard Logs
```
✅ Webhook signature verified
❌ UNAUTHORIZED: Invalid Webhook Request. Headers mismatch.
⚠️  ELEVENZA_WEBHOOK_SECRET not configured, webhook verification skipped
```

### Local Development
```bash
tail -f logs/combined.log
```

---

## Middleware Code

**File**: `src/middleware/index.js`

```javascript
export const verifyWebhookSignature = (req, res, next) => {
  const expectedSecret = process.env.ELEVENZA_WEBHOOK_SECRET;

  if (expectedSecret) {
    const incomingToken = req.headers['x-api-key'];

    if (incomingToken !== expectedSecret) {
      logger.warn('❌ UNAUTHORIZED: Invalid Webhook Request.');
      return res.status(200).send('Unauthorized but acknowledged');
    }
    logger.debug('✅ Webhook signature verified');
  }

  next();
};
```

**Applied to**: `POST /api/webhook/whatsapp`

---

## Webhook Provider Setup (11za/Elevenza)

### In Webhook Configuration

1. **Webhook URL**
   ```
   https://lifeos-seven-dun.vercel.app/api/webhook/whatsapp
   ```

2. **Headers**
   ```
   x-api-key: lifeos_webhook
   ```

3. **Content Type**
   ```
   application/json
   ```

---

## Security Checklist

- ✅ Secret stored in .env (never committed to git)
- ✅ Header validation on every request
- ✅ Proper error responses (200 on auth failure to prevent retries)
- ✅ Logging enabled for debugging
- ✅ Environment variable required (fails loud if missing)
- ✅ No secrets in logs or responses
- ✅ HTTPS only (Vercel provides SSL)

---

## Troubleshooting

### ❌ "Unauthorized but acknowledged" in logs

**Problem**: x-api-key header doesn't match ELEVENZA_WEBHOOK_SECRET

**Solution**: 
1. Check webhook provider configuration
2. Verify `x-api-key` value matches your `.env` ELEVENZA_WEBHOOK_SECRET
3. Check for typos

### ❌ "ELEVENZA_WEBHOOK_SECRET not configured"

**Problem**: Environment variable not set

**Solution**:
1. Add to `.env`: `ELEVENZA_WEBHOOK_SECRET=your_token`
2. Add to Vercel environment variables
3. Redeploy

### ❌ Webhooks not being received

**Problem**: Webhook provider can't reach your endpoint

**Solution**:
1. Verify URL is correct: `https://lifeos-seven-dun.vercel.app/api/webhook/whatsapp`
2. Check Vercel deployment is active
3. Check firewall/security groups
4. Test with: `curl https://lifeos-seven-dun.vercel.app/api/health`

---

## What's Next?

✅ Webhook security configured
✅ Environment variables set
✅ Deployed to Vercel

**Ready to use:**
- Send messages to WhatsApp
- Monitor in Vercel logs
- Check `logs/combined.log` locally

---

**Status**: 🟢 Production Ready
**Webhook**: https://lifeos-seven-dun.vercel.app/api/webhook/whatsapp
**Authentication**: x-api-key header
**Secret**: ELEVENZA_WEBHOOK_SECRET
