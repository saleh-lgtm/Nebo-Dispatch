#!/bin/bash
TOKEN="2U4KGw1phYQBCdv3f7606b1aa01c3044e9e2f3f755d5ed305"

# Get the login page HTML to see the form structure
curl -s -X POST "https://chrome.browserless.io/content?token=${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://system.tbrglobal.com/login"}' | grep -E "input|form|button" | head -50
