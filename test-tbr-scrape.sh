#!/bin/bash
TOKEN="2U4KGw1phYQBCdv3f7606b1aa01c3044e9e2f3f755d5ed305"

# Try export default format (v2 API)
curl -s -X POST "https://chrome.browserless.io/function?token=${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
  "code": "export default async function({ page }) { await page.goto(\"https://google.com\"); return { title: await page.title() }; }"
}'
