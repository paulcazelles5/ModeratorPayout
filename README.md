# AI Ticket Bot — Full Discord Management

Extremely complete ticket system. Everything is configured from Discord.

## Quick start

```
*staff add @SupportRole
*staff add @Moderator
*channel set #staff-requests
*config log #ticket-logs
*config transcripts #transcripts
*panel
```

## Staff management

```
*staff list
*staff add @user
*staff add @role
*staff remove @user
*staff remove @role
*staff role set @role
*staff role add @role
*staff role remove @role
```

Staff users and roles can see every ticket and use staff commands.

## Categories

```
*category list
*category add vip | VIP Support | ⭐ | Priority support
*category remove vip
```

## Config

```
*config show
*config log #channel
*config transcripts #channel
*config limit 2
*config autoclose 48
*config welcome Hello {user}! Category: {category}
*config panel Select a category to open a ticket.
*channel set #staff-channel
```

## Blacklist

```
*blacklist add @user
*blacklist remove @user
*blacklist list
```

## AI Prompt

```
*prompt show
*prompt set <text>
*prompt set   (+ attach .txt)
*prompt add <line>
*prompt reset
```

## Railway variables

```
DISCORD_TOKEN=
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=openai/gpt-oss-20b
```

Optional: `AI_SYSTEM_PROMPT` (overridden by `*prompt set`).
