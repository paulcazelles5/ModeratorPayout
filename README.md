# Payout Central Bot

## Railway deploy

1. Root directory: repo root
2. Start command: `node src/index.js`
3. Env vars:
   - `DISCORD_TOKEN`
   - `OPENAI_API_KEY` (Groq key)
   - Optional: `OPENAI_BASE_URL=https://api.groq.com/openai/v1`
   - Optional: `AI_MODEL=openai/gpt-oss-20b`

## After deploy

```
*panel
*channel log #logs
*channel modlog #mod-logs
*prompt reset
*staff add @role
```

## If bot is broken

Replace `src/index.js` with the full repaired file from the repair package (REPAIR_index.js renamed to index.js).
