# 🎫 AI Ticket Bot

Fully AI-powered Discord ticket system with advanced management features.

## Features

- **Multi-category panel** (General, Technical, Billing, Report, Other)
- **AI auto-replies** inside every ticket
- **Transcripts** (button + command + auto on close)
- **Log channel** for opened / closed tickets
- **Transcript channel** for archives
- **Staff role** support
- **Claim / Rename / Add / Remove** users
- **Open tickets list** + stats
- Everything configurable from Discord (`*config`)

## Commands

### Users
| Command | Description |
|---------|-------------|
| `*close [reason]` | Close the ticket |
| `*add @user` | Add someone to the ticket |
| `*remove @user` | Remove someone |
| `*transcript` | Generate transcript |

### Staff
| Command | Description |
|---------|-------------|
| `*claim` | Claim the ticket |
| `*rename <name>` | Rename the ticket |
| `*tickets` | List open tickets |
| `*stats` | Ticket statistics |

### Admin
| Command | Description |
|---------|-------------|
| `*panel` / `*setup` | Send the category panel |
| `*config` | Configure log channel, role, etc. |
| `*help` | Show all commands |

## Railway Variables

```
DISCORD_TOKEN=...
OPENAI_API_KEY=gsk_...
OPENAI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=openai/gpt-oss-20b
```

## Quick Setup

1. Deploy on Railway
2. In Discord: `*config log #your-log-channel`
3. `*config transcripts #your-transcript-channel`
4. `*config role @Support` (optional)
5. `*panel` in the channel where users should open tickets

---

100% manageable from Discord.
