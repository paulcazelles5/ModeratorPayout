require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType,
  PermissionFlagsBits, AttachmentBuilder, ModalBuilder, TextInputBuilder,
  TextInputStyle, AuditLogEvent,
} = require('discord.js');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const TOKEN = process.env.DISCORD_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
const AI_MODEL = process.env.AI_MODEL || 'llama-3.3-70b-versatile';
const PREFIX = '*';

// This is a temporary minimal version to stop the crash.
// Full bot will be restored in next commits.
console.log('[Payout Central] Starting...');

if (!TOKEN) {
  console.error('DISCORD_TOKEN missing');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

client.once('ready', () => {
  console.log(`[Payout Central] Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (message.content.trim() === '*ping') {
    return message.reply('Pong! Bot is alive.');
  }
  if (message.content.trim() === '*help') {
    return message.reply('Bot is recovering. Full features coming back shortly. Use *ping to test.');
  }
});

client.login(TOKEN).catch(e => {
  console.error('Login failed:', e.message);
  process.exit(1);
});
