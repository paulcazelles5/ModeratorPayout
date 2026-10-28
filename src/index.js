/**
 * Fixed entry point — the previous index.js tried to load missing c0–c11.txt
 * fragments, so the process crashed before Discord login (bot stayed offline).
 *
 * This file brings the bot ONLINE. Full ticket/AI features require the complete
 * source (bot.part1–3 were never uploaded / empty). Until then, basic presence works.
 */
require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
} = require('discord.js');

const TOKEN =
  process.env.DISCORD_TOKEN ||
  process.env.DISCORD_BOT_TOKEN ||
  process.env.TOKEN;

if (!TOKEN) {
  console.error(
    'Missing DISCORD_TOKEN (or DISCORD_BOT_TOKEN). Set it in .env or your host secrets.',
  );
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

function onReady() {
  console.info(`AI Ticket Bot online as ${client.user?.tag ?? 'unknown'}`);
  console.info(
    'Note: full ticket commands need the complete source (parts 1–3 were empty in the repo).',
  );
}

client.once(Events.ClientReady, onReady);
// Compat if Events.ClientReady string differs across discord.js minors
client.once('clientReady', onReady);
client.once('ready', onReady);

client.on('error', (err) => {
  console.error('Discord client error:', err?.message || err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err?.message || err);
});

client
  .login(TOKEN)
  .then(() => console.info('Gateway login successful — bot should appear online shortly.'))
  .catch((err) => {
    console.error('Login failed:', err?.message || err);
    process.exit(1);
  });
