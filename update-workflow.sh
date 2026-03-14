#!/bin/bash
API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3Y2E4YWY5Ny1kZjQ3LTQwNTktOTRhMS0yYWJkMDdmZjdkYWIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWU3MWZmOGQtYWU0ZS00Njc3LTg1NTEtNWEzZmFjMTE0YTlkIiwiaWF0IjoxNzcyMjMwNDU3LCJleHAiOjE3NzQ3NjA0MDB9.i9khbijXlfT3-GSHVmHvu_teGOiOcYT94qHj-cGafGw"
WORKFLOW_ID="8Rz7HZiGPNKGvMmC"

curl -s -X PUT "https://neborides.app.n8n.cloud/api/v1/workflows/${WORKFLOW_ID}" \
  -H "X-N8N-API-KEY: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d @/Users/salehzahran/Desktop/Nebo-dispatch-app/n8n-workflows/tbr-browserless-scraper.json
