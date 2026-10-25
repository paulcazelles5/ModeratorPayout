require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  AttachmentBuilder,
} = require('discord.js');
const OpenAI = require('openai');

// ==================== CONFIG ====================
const TOKEN = process.env.DISCORD_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const AI_MODEL = process.env.AI_MODEL || 'llama-3.3-70b-versatile';
const PREFIX = '*';

const SYSTEM_PROMPT =
  process.env.AI_SYSTEM_PROMPT ||
  `You are a professional and friendly support assistant. You answer clearly, concisely and helpfully. If you cannot solve the problem, suggest alternative solutions. Always reply in the same language the user is writing in.`;

if (!TOKEN || !OPENAI_API_KEY) {
  console.error('❌ Missing environment variables (DISCORD_TOKEN, OPENAI_API_KEY)');
  process.exit(1);
}

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

// Conversation memory per channel
const conversations = new Map(); // channelId -> [{role, content}]

// ==================== AI RESPONSE ====================
async function getAIResponse(channelId, userMessage, username) {
  if (!conversations.has(channelId)) {
    conversations.set(channelId, [{ role: 'system', content: SYSTEM_PROMPT }]);
  }

  const history = conversations.get(channelId);
  history.push({ role: 'user', content: `[${username}]: ${userMessage}` });

  // Keep history reasonable
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
    console.error('AI Error:', err.message);
    return 'Sorry, I am experiencing a technical issue right now. Please try again in a moment.';
  }
}

// ==================== CREATE TICKET ====================
async function createTicket(interactionOrMessage, user) {
  const guild = interactionOrMessage.guild;

  // Check if user already has an open ticket
  const existing = guild.channels.cache.find(
    (c) =>
      c.name === `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}` &&
      c.type === ChannelType.GuildText
  );

  if (existing) {
    const msg = `You already have an open ticket: ${existing}`;
    if (interactionOrMessage.reply) {
      return interactionOrMessage.reply({ content: msg, ephemeral: true });
    }
    return interactionOrMessage.channel.send(msg);
  }

  // Defer if it's a button interaction
  if (interactionOrMessage.deferReply) {
    await interactionOrMessage.deferReply({ ephemeral: true });
  }

  // Find or create "Tickets" category
  let category = guild.channels.cache.find(
    (c) => c.name.toLowerCase() === 'tickets' && c.type === ChannelType.GuildCategory
  );

  if (!category) {
    category = await guild.channels.create({
      name: 'Tickets',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
      ],
    });
  }

  const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`;

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
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
    ],
    topic: `Ticket of ${user.tag} | ID: ${user.id}`,
  });

  // Init conversation
  conversations.set(channel.id, [{ role: 'system', content: SYSTEM_PROMPT }]);

  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎫 Ticket Opened')
    .setDescription(
      `Hello ${user}!\n\nPlease describe your issue or question. I'm here to help.\n\nWhen you're done, click **Close Ticket** or type \`*close\`.`
    )
    .setFooter({ text: 'AI Support • Automatic responses' })
    .setTimestamp();

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒')
  );

  await channel.send({
    content: `${user}`,
    embeds: [welcomeEmbed],
    components: [closeRow],
  });

  const successMsg = `✅ Your ticket has been created: ${channel}`;

  if (interactionOrMessage.editReply) {
    await interactionOrMessage.editReply({ content: successMsg });
  } else if (interactionOrMessage.reply) {
    await interactionOrMessage.reply({ content: successMsg, ephemeral: true });
  } else {
    await interactionOrMessage.channel.send(successMsg);
  }
}

// ==================== CLOSE TICKET ====================
async function closeTicket(channel, user) {
  if (!channel.name.startsWith('ticket-')) {
    return channel.send('❌ This channel is not a ticket.');
  }

  let transcript = `Ticket Transcript: ${channel.name}\nClosed by: ${user.tag}\nDate: ${new Date().toUTCString()}\n\n`;

  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    for (const msg of sorted.values()) {
      if (msg.author.bot && !msg.embeds.length) continue;
      const content = msg.content || (msg.embeds[0]?.description ?? '[embed]');
      transcript += `[${msg.createdAt.toUTCString()}] ${msg.author.tag}: ${content}\n`;
    }
  } catch {
    transcript += '(Could not fetch all messages)\n';
  }

  // Send transcript in DM
  try {
    const ownerId = channel.topic?.match(/ID: (\d+)/)?.[1];
    if (ownerId) {
      const member = await channel.guild.members.fetch(ownerId).catch(() => null);
      if (member) {
        const buffer = Buffer.from(transcript, 'utf-8');
        const attachment = new AttachmentBuilder(buffer, {
          name: `transcript-${channel.name}.txt`,
        });
        await member
          .send({
            content: 'Here is the transcript of your ticket:',
            files: [attachment],
          })
          .catch(() => {});
      }
    }
  } catch {}

  conversations.delete(channel.id);

  await channel.send('🔒 Closing ticket in 5 seconds...');
  setTimeout(() => {
    channel.delete().catch(() => {});
  }, 5000);
}

// ==================== EVENTS ====================
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`Prefix: ${PREFIX}`);
});

// Button interactions
client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'open_ticket') {
      await createTicket(interaction, interaction.user);
      return;
    }

    if (interaction.customId === 'close_ticket') {
      await interaction.deferUpdate();
      await closeTicket(interaction.channel, interaction.user);
    }
  } catch (err) {
    console.error('Interaction error:', err);
  }
});

// Prefix commands + AI responses
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();

  // ===== PREFIX COMMANDS =====
  if (content.startsWith(PREFIX)) {
    const args = content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    // *setup → send ticket panel (Admin only)
    if (command === 'setup') {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('❌ You need Administrator permission to use this command.');
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🎫 Support')
        .setDescription(
          'Need help? Click the button below to open a ticket.\n\nAn AI assistant will respond to you automatically.'
        )
        .setFooter({ text: '100% Automated Support' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('open_ticket')
          .setLabel('Open a Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📩')
      );

      await message.channel.send({ embeds: [embed], components: [row] });
      await message.reply('✅ Ticket panel sent!');
      return;
    }

    // *close → close current ticket
    if (command === 'close') {
      if (!message.channel.name.startsWith('ticket-')) {
        return message.reply('❌ This command can only be used inside a ticket.');
      }
      await closeTicket(message.channel, message.author);
      return;
    }

    // *help
    if (command === 'help') {
      const helpEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🎫 Ticket Bot Commands')
        .setDescription(
          `**${PREFIX}setup** — Send the ticket panel (Admin only)\n` +
            `**${PREFIX}close** — Close the current ticket\n` +
            `**${PREFIX}help** — Show this message`
        )
        .setFooter({ text: 'AI-powered support' });

      return message.reply({ embeds: [helpEmbed] });
    }

    return; // Unknown command, ignore
  }

  // ===== AI RESPONSE IN TICKETS =====
  if (!message.channel.name?.startsWith('ticket-')) return;
  if (!content || content.length < 2) return;

  await message.channel.sendTyping().catch(() => {});

  const reply = await getAIResponse(
    message.channel.id,
    content,
    message.author.username
  );

  if (reply.length > 2000) {
    const chunks = reply.match(/[\s\S]{1,1900}/g) || [reply];
    for (const chunk of chunks) {
      await message.channel.send(chunk);
    }
  } else {
    await message.channel.send(reply);
  }
});

// ==================== LOGIN ====================
client.login(TOKEN);
