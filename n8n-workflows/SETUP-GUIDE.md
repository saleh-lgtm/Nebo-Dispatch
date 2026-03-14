# n8n Manifest Email Ingestion - Setup Guide

## Overview

This workflow processes manifest emails from LimoAnywhere via Cloudflare Email Routing and creates TripConfirmation records in Nebo.

```
LimoAnywhere → manifests@neboops.com → Cloudflare Email Routing → n8n Webhook → Nebo API
```

---

## Step 1: Import Workflow into n8n

1. Go to https://neborides.app.n8n.cloud
2. Click **Workflows** → **Add Workflow** → **Import from File**
3. Upload `manifest-email-ingestion.json`
4. Save the workflow

---

## Step 2: Create Credentials in n8n

### HTTP Header Auth (Required)

1. Go to **Settings** → **Credentials** → **Add Credential**
2. Search for **HTTP Header Auth**
3. Configure:
   - **Name**: `Nebo Manifest Auth`
   - **Header Name**: `x-manifest-secret`
   - **Header Value**: Your `MANIFEST_INGEST_SECRET` from Nebo's environment variables

### Slack (Optional)

1. Go to **Settings** → **Credentials** → **Add Credential**
2. Search for **Slack API**
3. Configure with your Slack bot token
4. Update the channel name in the Slack node (default: `#dispatch-alerts`)

---

## Step 3: Update Nebo API URL

In the **POST to Nebo API** node, update the URL to your actual Nebo app URL:

```
https://your-nebo-app.vercel.app/api/manifests/ingest
```

---

## Step 4: Configure Cloudflare Email Routing

1. Go to Cloudflare Dashboard → Your Domain (neboops.com) → **Email** → **Email Routing**
2. Click **Routing Rules** → **Create address**
3. Configure:
   - **Custom address**: `manifests`
   - **Action**: **Send to a Worker** OR **Call a webhook**

   If using webhook directly:
   - **Destination**: `https://neborides.app.n8n.cloud/webhook/manifest-ingest`

### Alternative: Use Cloudflare Worker

If Cloudflare doesn't support direct webhook, create a Worker:

```javascript
export default {
  async email(message, env, ctx) {
    const body = await new Response(message.raw).text();

    const payload = {
      from: message.from,
      to: message.to,
      subject: message.headers.get('subject'),
      body: body,
    };

    await fetch('https://neborides.app.n8n.cloud/webhook/manifest-ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
};
```

---

## Step 5: Configure LimoAnywhere

1. In LimoAnywhere, go to **Settings** → **Manifest Email**
2. Set destination email: `manifests@neboops.com`
3. Configure frequency: Every 2 hours (or as needed)
4. Include: Current date + Next date trips

---

## Step 6: Test the Workflow

### Test via n8n

1. Click **Test Workflow** in n8n
2. Send a test POST request:

```bash
curl -X POST https://neborides.app.n8n.cloud/webhook/manifest-ingest \
  -H "Content-Type: application/json" \
  -d '{
    "from": "test@limoanywhere.com",
    "subject": "Daily Manifest",
    "body": "02/27/2026 - Pick Up At:10:30 AM\n12345\nPassenger John Smith\nDriver Info Mike Driver\nAccount CORP001"
  }'
```

### Test via Email

1. Send a test email to `manifests@neboops.com`
2. Check n8n execution history
3. Verify TripConfirmation created in Nebo

---

## Step 7: Activate Workflow

1. Toggle the workflow to **Active** (top right)
2. The webhook is now live and listening

---

## Webhook URL

```
https://neborides.app.n8n.cloud/webhook/manifest-ingest
```

---

## Troubleshooting

### No trips created?
- Check email body format matches expected pattern
- Verify `MANIFEST_INGEST_SECRET` matches between n8n and Nebo

### Authentication error?
- Verify HTTP Header Auth credential is configured correctly
- Check the header name is exactly `x-manifest-secret`

### Email not reaching n8n?
- Check Cloudflare Email Routing logs
- Verify the routing rule is active

---

## Monitoring

- Check n8n **Executions** for workflow runs
- Review Slack notifications for manifest processing results
- Check Nebo `/admin/confirmations` for created trips

---

*Last updated: February 27, 2026*
