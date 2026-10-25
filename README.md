# 🎫 AI Ticket Bot

Fully AI-powered Discord ticket bot.  
No staff needed — the AI handles support tickets automatically.

## Features

- Ticket panel with button
- Private channel created per ticket
- Real-time AI responses (Groq / OpenAI / any compatible API)
- Prefix commands (`*`)
- Close button + `*close` command
- Transcript sent in DM when ticket is closed

## Commands

| Command | Description |
|---------|-------------|
| `*setup` | Send the ticket panel (Admin only) |
| `*close` | Close the current ticket |
| `*help` | Show available commands |

## Deploy on Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select `paulcazelles5/ModeratorPayout`
3. Add the variables below in the **Variables** tab
4. Deploy

### Environment Variables

| Variable | Value |
|----------|-------|
| `DISCORD_TOKEN` | Your Discord bot token |
| `OPENAI_API_KEY` | Your Groq key (`gsk_...`) |
| `OPENAI_BASE_URL` | `https://api.groq.com/openai/v1` |
| `AI_MODEL` | `llama-3.3-70b-versatile` |
| `AI_SYSTEM_PROMPT` | (optional) Custom system prompt |

> **Important**: Enable **Message Content Intent** and **Server Members Intent** in the [Discord Developer Portal](https://discord.com/developers/applications).

## Local Setup

```bash
git clone https://github.com/paulcazelles5/ModeratorPayout.git
cd ModeratorPayout
npm install
cp .env.example .env
# Edit .env
npm start
```

## Usage

1. In any channel → `*setup`
2. Users click **Open a Ticket**
3. AI responds automatically
4. Close with the button or `*close`

---

100% automated support.
