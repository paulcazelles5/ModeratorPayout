require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// ==================== CONFIG ====================
const TOKEN = process.env.DISCORD_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
const AI_MODEL = process.env.AI_MODEL || 'openai/gpt-oss-20b';
const PREFIX = '*';

const SYSTEM_PROMPT =
  process.env.AI_SYSTEM_PROMPT ||
  `You are a professional and friendly support assistant. You answer clearly, concisely and helpfully. If you cannot solve the problem, suggest alternative solutions. Always reply in English.`;

if (!TOKEN || !OPENAI_API_KEY) {
  console.error('❌ Missing DISCORD_TOKEN or OPENAI_API_KEY');
  process.exit(1);
}

// ==================== PERSISTENT DATA ====================
const DATA_PATH = path.join(__dirname, '..', 'data.json');

function loadData() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    }
  } catch {}
  return {
    ticketCounter: 0,
    logChannelId: null,
    transcriptChannelId: null,
    supportRoleId: null,
    categories: [
      { id: 'general', label: 'General Support', emoji: '💬', description: 'General questions and help' },
      { id: 'technical', label: 'Technical Issue', emoji: '🛠️', description: 'Bugs, errors, technical problems' },
      { id: 'billing', label: 'Billing', emoji: '💳', description: 'Payments, refunds, invoices' },
      { id: 'report', label: 'Report User', emoji: '🚨', description: 'Report a user or abuse' },
      { id: 'other', label: 'Other', emoji: '📌', description: 'Anything else' },
    ],
    openTickets: {}, // channelId -> { number, userId, category, createdAt, claimedBy }
  };
}

function saveData() {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save data.json:', e.message);
  }
}

let data = loadData();

// ==================== CLIENT ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message],
});

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: OPENAI_BASE_URL,
});

const conversations = new Map();

// ==================== HELPERS ====================
function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

function isStaff(member) {
  if (isAdmin(member)) return true;
  if (data.supportRoleId && member.roles.cache.has(data.supportRoleId)) return true;
  return false;
}

function getTicketInfo(channelId) {
  return data.openTickets[channelId] || null;
}

async function sendLog(guild, embed) {
  if (!data.logChannelId) return;
  const ch = guild.channels.cache.get(data.logChannelId);
  if (ch) await ch.send({ embeds: [embed] }).catch(() => {});
}

async function generateTranscript(channel) {
  let text = `═══════════════════════════════════════\n`;
  text += `TICKET TRANSCRIPT\n`;
  text += `Channel: ${channel.name}\n`;
  text += `Date: ${new Date().toUTCString()}\n`;
  text += `═══════════════════════════════════════\n\n`;

  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    for (const msg of sorted) {
      const time = msg.createdAt.toISOString().replace('T', ' ').slice(0, 19);
      const author = msg.author.tag;
      let content = msg.content || '';
      if (msg.embeds.length) {
        content += msg.embeds.map((e) => e.description || e.title || '[embed]').join(' | ');
      }
      if (msg.attachments.size) {
        content += ' [attachments: ' + [...msg.attachments.values()].map((a) => a.url).join(', ') + ']';
      }
      text += `[${time}] ${author}: ${content}\n`;
    }
  } catch {
    text += '(Could not fetch all messages)\n';
  }

  text += `\n═══════════════════════════════════════\nEnd of transcript\n`;
  return text;
}

// ==================== AI ====================
async function getAIResponse(channelId, userMessage, username) {
  if (!conversations.has(channelId)) {
    conversations.set(channelId, [{ role: 'system', content: SYSTEM_PROMPT }]);
  }

  const history = conversations.get(channelId);
  history.push({ role: 'user', content: `[${username}]: ${userMessage}` });

  if (history.length > 30) {
    history.splice(1, history.length - 25);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: history,
      temperature: 0.7,
      max_tokens: 800,
    });

    const reply = completion.choices[0].message.content;
    history.push({ role: 'assistant', content: reply });
    return reply;
  } catch (err) {
    console.error('[AI Error]', err.status || '', err.message);
    return 'Sorry, I am experiencing a technical issue right now. Please try again in a moment.';
  }
}

// ==================== CREATE TICKET ====================
async function createTicket(guild, user, categoryId, interaction) {
  // Already has open ticket?
  const existing = Object.entries(data.openTickets).find(([, t]) => t.userId === user.id);
  if (existing) {
    const ch = guild.channels.cache.get(existing[0]);
    const msg = ch
      ? `You already have an open ticket: ${ch}`
      : 'You already have an open ticket.';
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: msg });
    }
    return interaction.reply({ content: msg, ephemeral: true });
  }

  const category = data.categories.find((c) => c.id === categoryId) || data.categories[0];

  data.ticketCounter += 1;
  const ticketNumber = data.ticketCounter;
  const channelName = `ticket-${String(ticketNumber).padStart(4, '0')}`;

  // Category channel
  let parent = guild.channels.cache.find(
    (c) => c.name.toLowerCase() === 'tickets' && c.type === ChannelType.GuildCategory
  );
  if (!parent) {
    parent = await guild.channels.create({
      name: 'Tickets',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }],
    });
  }

  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];

  if (data.supportRoleId) {
    overwrites.push({
      id: data.supportRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: parent.id,
    topic: `Ticket #${ticketNumber} | ${user.tag} | ${category.label} | ID: ${user.id}`,
    permissionOverwrites: overwrites,
  });

  data.openTickets[channel.id] = {
    number: ticketNumber,
    userId: user.id,
    category: category.id,
    categoryLabel: category.label,
    createdAt: Date.now(),
    claimedBy: null,
  };
  saveData();

  conversations.set(channel.id, [{ role: 'system', content: SYSTEM_PROMPT }]);

  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${category.emoji} Ticket #${ticketNumber} — ${category.label}`)
    .setDescription(
      `Hello ${user}!\n\n` +
        `**Category:** ${category.label}\n` +
        `Please describe your issue in detail. An AI assistant will help you.\n\n` +
        `**Commands:**\n` +
        `\`*close [reason]\` — Close this ticket\n` +
        `\`*add @user\` — Add someone to the ticket\n` +
        `\`*transcript\` — Generate a transcript`
    )
    .setFooter({ text: 'AI Support • Fully automated' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒'),
    new ButtonBuilder()
      .setCustomId('transcript_ticket')
      .setLabel('Transcript')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📄')
  );

  await channel.send({ content: `${user}`, embeds: [welcomeEmbed], components: [row] });

  // Log
  const logEmbed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('🎫 Ticket Opened')
    .addFields(
      { name: 'Ticket', value: `#${ticketNumber}`, inline: true },
      { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
      { name: 'Category', value: category.label, inline: true },
      { name: 'Channel', value: `${channel}`, inline: true }
    )
    .setTimestamp();
  await sendLog(guild, logEmbed);

  const success = `✅ Ticket created: ${channel}`;
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content: success });
  } else {
    await interaction.reply({ content: success, ephemeral: true });
  }
}

// ==================== CLOSE TICKET ====================
async function closeTicket(channel, user, reason = 'No reason provided') {
  const info = getTicketInfo(channel.id);
  if (!info && !channel.name.startsWith('ticket-')) {
    return channel.send('❌ This is not a ticket channel.');
  }

  const transcript = await generateTranscript(channel);
  const buffer = Buffer.from(transcript, 'utf-8');
  const fileName = `transcript-${info ? info.number : channel.name}.txt`;
  const attachment = new AttachmentBuilder(buffer, { name: fileName });

  // DM user
  try {
    const ownerId = info?.userId || channel.topic?.match(/ID: (\d+)/)?.[1];
    if (ownerId) {
      const member = await channel.guild.members.fetch(ownerId).catch(() => null);
      if (member) {
        await member
          .send({
            content: `Your ticket **#${info?.number || '?'}** has been closed.\n**Reason:** ${reason}`,
            files: [attachment],
          })
          .catch(() => {});
      }
    }
  } catch {}

  // Transcript channel
  if (data.transcriptChannelId) {
    const tCh = channel.guild.channels.cache.get(data.transcriptChannelId);
    if (tCh) {
      const tEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(`📄 Transcript — Ticket #${info?.number || '?'}`)
        .addFields(
          { name: 'Closed by', value: user.tag, inline: true },
          { name: 'Reason', value: reason, inline: true },
          { name: 'Category', value: info?.categoryLabel || 'Unknown', inline: true }
        )
        .setTimestamp();
      await tCh.send({ embeds: [tEmbed], files: [attachment] }).catch(() => {});
    }
  }

  // Log
  const logEmbed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🔒 Ticket Closed')
    .addFields(
      { name: 'Ticket', value: `#${info?.number || '?'}`, inline: true },
      { name: 'Closed by', value: user.tag, inline: true },
      { name: 'Reason', value: reason, inline: false }
    )
    .setTimestamp();
  await sendLog(channel.guild, logEmbed);

  // Cleanup
  delete data.openTickets[channel.id];
  saveData();
  conversations.delete(channel.id);

  await channel.send(`🔒 Ticket closed by **${user.tag}**.\n**Reason:** ${reason}\nDeleting in 5 seconds...`);
  setTimeout(() => channel.delete().catch(() => {}), 5000);
}

// ==================== READY ====================
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`Prefix: ${PREFIX} | Model: ${AI_MODEL}`);
  console.log(`Open tickets: ${Object.keys(data.openTickets).length}`);
});

// ==================== INTERACTIONS ====================
client.on('interactionCreate', async (interaction) => {
  try {
    // Select menu → open ticket with category
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_category') {
      await interaction.deferReply({ ephemeral: true });
      const categoryId = interaction.values[0];
      await createTicket(interaction.guild, interaction.user, categoryId, interaction);
      return;
    }

    // Buttons
    if (interaction.isButton()) {
      if (interaction.customId === 'close_ticket') {
        // Ask for reason via modal
        const modal = new ModalBuilder()
          .setCustomId('close_modal')
          .setTitle('Close Ticket');

        const reasonInput = new TextInputBuilder()
          .setCustomId('close_reason')
          .setLabel('Reason for closing')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Issue resolved / No response / etc.')
          .setRequired(false)
          .setMaxLength(200);

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
        return;
      }

      if (interaction.customId === 'transcript_ticket') {
        await interaction.deferReply({ ephemeral: true });
        const transcript = await generateTranscript(interaction.channel);
        const buffer = Buffer.from(transcript, 'utf-8');
        const attachment = new AttachmentBuilder(buffer, {
          name: `transcript-${interaction.channel.name}.txt`,
        });
        await interaction.editReply({
          content: '📄 Here is the transcript:',
          files: [attachment],
        });
        return;
      }
    }

    // Modal submit (close reason)
    if (interaction.isModalSubmit() && interaction.customId === 'close_modal') {
      await interaction.deferUpdate();
      const reason = interaction.fields.getTextInputValue('close_reason') || 'No reason provided';
      await closeTicket(interaction.channel, interaction.user, reason);
    }
  } catch (err) {
    console.error('Interaction error:', err);
  }
});

// ==================== PREFIX COMMANDS ====================
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();

  // ===== COMMANDS =====
  if (content.startsWith(PREFIX)) {
    const args = content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    // ---------- *panel / *setup ----------
    if (command === 'panel' || command === 'setup') {
      if (!isAdmin(message.member)) {
        return message.reply('❌ Administrator only.');
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🎫 Support Tickets')
        .setDescription(
          'Need help? Select a category below to open a private ticket.\n\n' +
            'An AI assistant will respond automatically. Staff can also join if needed.\n\n' +
            data.categories.map((c) => `${c.emoji} **${c.label}** — ${c.description}`).join('\n')
        )
        .setFooter({ text: 'Fully automated AI support' })
        .setTimestamp();

      const select = new StringSelectMenuBuilder()
        .setCustomId('ticket_category')
        .setPlaceholder('Choose a category...')
        .addOptions(
          data.categories.map((c) => ({
            label: c.label,
            description: c.description.slice(0, 100),
            value: c.id,
            emoji: c.emoji,
          }))
        );

      const row = new ActionRowBuilder().addComponents(select);
      await message.channel.send({ embeds: [embed], components: [row] });
      return message.reply('✅ Ticket panel sent!');
    }

    // ---------- *close [reason] ----------
    if (command === 'close') {
      if (!message.channel.name.startsWith('ticket-')) {
        return message.reply('❌ This command only works inside a ticket.');
      }
      const reason = args.join(' ') || 'No reason provided';
      await closeTicket(message.channel, message.author, reason);
      return;
    }

    // ---------- *add @user ----------
    if (command === 'add') {
      if (!message.channel.name.startsWith('ticket-')) {
        return message.reply('❌ Only usable inside a ticket.');
      }
      const member = message.mentions.members.first();
      if (!member) return message.reply('Usage: `*add @user`');

      await message.channel.permissionOverwrites.edit(member.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
      return message.reply(`✅ Added ${member} to the ticket.`);
    }

    // ---------- *remove @user ----------
    if (command === 'remove') {
      if (!message.channel.name.startsWith('ticket-')) {
        return message.reply('❌ Only usable inside a ticket.');
      }
      const member = message.mentions.members.first();
      if (!member) return message.reply('Usage: `*remove @user`');

      await message.channel.permissionOverwrites.delete(member.id);
      return message.reply(`✅ Removed ${member} from the ticket.`);
    }

    // ---------- *rename <name> ----------
    if (command === 'rename') {
      if (!message.channel.name.startsWith('ticket-')) {
        return message.reply('❌ Only usable inside a ticket.');
      }
      if (!isStaff(message.member)) {
        return message.reply('❌ Staff only.');
      }
      const newName = args.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20);
      if (!newName) return message.reply('Usage: `*rename new-name`');

      const info = getTicketInfo(message.channel.id);
      const prefix = info ? `ticket-${String(info.number).padStart(4, '0')}` : 'ticket';
      await message.channel.setName(`${prefix}-${newName}`);
      return message.reply(`✅ Ticket renamed.`);
    }

    // ---------- *transcript ----------
    if (command === 'transcript') {
      if (!message.channel.name.startsWith('ticket-')) {
        return message.reply('❌ Only usable inside a ticket.');
      }
      const transcript = await generateTranscript(message.channel);
      const buffer = Buffer.from(transcript, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, {
        name: `transcript-${message.channel.name}.txt`,
      });
      return message.reply({ content: '📄 Transcript:', files: [attachment] });
    }

    // ---------- *tickets / *list ----------
    if (command === 'tickets' || command === 'list') {
      const entries = Object.entries(data.openTickets);
      if (entries.length === 0) {
        return message.reply('📭 No open tickets.');
      }

      const lines = entries.map(([channelId, t]) => {
        const ch = message.guild.channels.cache.get(channelId);
        const age = Math.floor((Date.now() - t.createdAt) / 60000);
        return `**#${t.number}** — ${t.categoryLabel} — <@${t.userId}> — ${ch || 'deleted'} — ${age}m ago`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🎫 Open Tickets (${entries.length})`)
        .setDescription(lines.join('\n').slice(0, 4000))
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // ---------- *claim ----------
    if (command === 'claim') {
      if (!message.channel.name.startsWith('ticket-')) {
        return message.reply('❌ Only usable inside a ticket.');
      }
      if (!isStaff(message.member)) {
        return message.reply('❌ Staff only.');
      }

      const info = getTicketInfo(message.channel.id);
      if (!info) return message.reply('❌ Ticket data not found.');

      info.claimedBy = message.author.id;
      saveData();

      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setDescription(`📌 Ticket claimed by ${message.author}`);
      return message.channel.send({ embeds: [embed] });
    }

    // ---------- *stats ----------
    if (command === 'stats') {
      const open = Object.keys(data.openTickets).length;
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📊 Ticket Stats')
        .addFields(
          { name: 'Open tickets', value: `${open}`, inline: true },
          { name: 'Total created', value: `${data.ticketCounter}`, inline: true },
          { name: 'Categories', value: `${data.categories.length}`, inline: true }
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    // ---------- *config ----------
    if (command === 'config') {
      if (!isAdmin(message.member)) {
        return message.reply('❌ Administrator only.');
      }

      const sub = args[0]?.toLowerCase();

      if (!sub || sub === 'show') {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('⚙️ Bot Configuration')
          .addFields(
            {
              name: 'Log Channel',
              value: data.logChannelId ? `<#${data.logChannelId}>` : 'Not set',
              inline: true,
            },
            {
              name: 'Transcript Channel',
              value: data.transcriptChannelId ? `<#${data.transcriptChannelId}>` : 'Not set',
              inline: true,
            },
            {
              name: 'Support Role',
              value: data.supportRoleId ? `<@&${data.supportRoleId}>` : 'Not set',
              inline: true,
            },
            {
              name: 'Categories',
              value: data.categories.map((c) => `${c.emoji} ${c.label}`).join('\n') || 'None',
            }
          )
          .setFooter({ text: 'Use *config help for commands' });
        return message.reply({ embeds: [embed] });
      }

      if (sub === 'help') {
        return message.reply(
          '**Config commands:**\n' +
            '`*config show` — Show current config\n' +
            '`*config log #channel` — Set log channel\n' +
            '`*config transcripts #channel` — Set transcript channel\n' +
            '`*config role @role` — Set support role\n' +
            '`*config reset` — Reset config to defaults'
        );
      }

      if (sub === 'log') {
        const ch = message.mentions.channels.first();
        if (!ch) return message.reply('Usage: `*config log #channel`');
        data.logChannelId = ch.id;
        saveData();
        return message.reply(`✅ Log channel set to ${ch}`);
      }

      if (sub === 'transcripts') {
        const ch = message.mentions.channels.first();
        if (!ch) return message.reply('Usage: `*config transcripts #channel`');
        data.transcriptChannelId = ch.id;
        saveData();
        return message.reply(`✅ Transcript channel set to ${ch}`);
      }

      if (sub === 'role') {
        const role = message.mentions.roles.first();
        if (!role) return message.reply('Usage: `*config role @role`');
        data.supportRoleId = role.id;
        saveData();
        return message.reply(`✅ Support role set to ${role}`);
      }

      if (sub === 'reset') {
        data = loadData();
        data.ticketCounter = data.ticketCounter || 0;
        data.openTickets = data.openTickets || {};
        data.logChannelId = null;
        data.transcriptChannelId = null;
        data.supportRoleId = null;
        saveData();
        return message.reply('✅ Config reset.');
      }

      return message.reply('Unknown config option. Use `*config help`.');
    }

    // ---------- *help ----------
    if (command === 'help') {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🎫 Ticket Bot — Commands')
        .setDescription(
          '**User Commands**\n' +
            '`*close [reason]` — Close the current ticket\n' +
            '`*add @user` — Add a user to the ticket\n' +
            '`*remove @user` — Remove a user from the ticket\n' +
            '`*transcript` — Generate a transcript\n\n' +
            '**Staff Commands**\n' +
            '`*claim` — Claim the ticket\n' +
            '`*rename <name>` — Rename the ticket\n' +
            '`*tickets` — List all open tickets\n' +
            '`*stats` — Show ticket statistics\n\n' +
            '**Admin Commands**\n' +
            '`*panel` / `*setup` — Send the ticket panel\n' +
            '`*config` — Configure the bot'
        )
        .setFooter({ text: 'AI-powered ticket system' });
      return message.reply({ embeds: [embed] });
    }

    return;
  }

  // ===== AI IN TICKETS =====
  if (!message.channel.name?.startsWith('ticket-')) return;
  if (!content || content.length < 2) return;

  // Don't reply to staff messages if you want (optional)
  // if (isStaff(message.member)) return;

  await message.channel.sendTyping().catch(() => {});

  const reply = await getAIResponse(message.channel.id, content, message.author.username);

  if (reply.length > 2000) {
    const chunks = reply.match(/[\s\S]{1,1900}/g) || [reply];
    for (const chunk of chunks) await message.channel.send(chunk);
  } else {
    await message.channel.send(reply);
  }
});

// ==================== LOGIN ====================
client.login(TOKEN);
