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
  SlashCommandBuilder,
  REST,
  Routes,
  AttachmentBuilder,
} = require('discord.js');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// ==================== CONFIG ====================
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const SYSTEM_PROMPT =
  process.env.AI_SYSTEM_PROMPT ||
  `Tu es un assistant de support professionnel et amical. Tu réponds clairement, de façon concise et utile. Si tu ne peux pas résoudre le problème, propose des solutions alternatives. Réponds toujours en français sauf si l'utilisateur écrit dans une autre langue.`;

if (!TOKEN || !CLIENT_ID || !GUILD_ID || !OPENAI_API_KEY) {
  console.error('❌ Variables manquantes dans .env (DISCORD_TOKEN, CLIENT_ID, GUILD_ID, OPENAI_API_KEY)');
  process.exit(1);
}

// ==================== CLIENTS ====================
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

// Mémoire des conversations par channel (simple, en RAM)
const conversations = new Map(); // channelId -> [{role, content}]

// ==================== SLASH COMMANDS ====================
const commands = [
  new SlashCommandBuilder()
    .setName('setup-tickets')
    .setDescription('Envoie le panneau de tickets dans ce salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('close')
    .setDescription('Ferme le ticket actuel'),
].map((cmd) => cmd.toJSON());

// ==================== REGISTER COMMANDS ====================
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('🔄 Enregistrement des commandes slash...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log('✅ Commandes enregistrées !');
  } catch (err) {
    console.error('Erreur enregistrement commandes:', err);
  }
}

// ==================== AI RESPONSE ====================
async function getAIResponse(channelId, userMessage, username) {
  if (!conversations.has(channelId)) {
    conversations.set(channelId, [
      { role: 'system', content: SYSTEM_PROMPT },
    ]);
  }

  const history = conversations.get(channelId);
  history.push({ role: 'user', content: `[${username}]: ${userMessage}` });

  // Limite l'historique pour ne pas exploser le contexte
  if (history.length > 30) {
    history.splice(1, history.length - 25); // garde system + derniers messages
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
    console.error('Erreur OpenAI:', err.message);
    return "Désolé, je rencontre un problème technique pour le moment. Réessaie dans quelques instants.";
  }
}

// ==================== CREATE TICKET ====================
async function createTicket(interaction) {
  const guild = interaction.guild;
  const user = interaction.user;

  // Vérifie si l'utilisateur a déjà un ticket ouvert
  const existing = guild.channels.cache.find(
    (c) =>
      c.name === `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}` &&
      c.type === ChannelType.GuildText
  );

  if (existing) {
    return interaction.reply({
      content: `Tu as déjà un ticket ouvert : ${existing}`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  // Cherche ou crée la catégorie "Tickets"
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
    topic: `Ticket de ${user.tag} | ID: ${user.id}`,
  });

  // Initialise la conversation
  conversations.set(channel.id, [
    { role: 'system', content: SYSTEM_PROMPT },
  ]);

  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎫 Ticket ouvert')
    .setDescription(
      `Bonjour ${user} !\n\nDécris ton problème ou ta question, je suis là pour t'aider.\n\nQuand tu auras fini, clique sur **Fermer le ticket**.`
    )
    .setFooter({ text: 'Support IA • Réponse automatique' })
    .setTimestamp();

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Fermer le ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒')
  );

  await channel.send({
    content: `${user}`,
    embeds: [welcomeEmbed],
    components: [closeRow],
  });

  await interaction.editReply({
    content: `✅ Ton ticket a été créé : ${channel}`,
  });
}

// ==================== CLOSE TICKET ====================
async function closeTicket(channel, user) {
  if (!channel.name.startsWith('ticket-')) {
    return channel.send('❌ Ce salon n'est pas un ticket.');
  }

  // Génère un petit transcript
  let transcript = `Transcript du ticket ${channel.name}\nFermé par : ${user.tag}\nDate : ${new Date().toLocaleString('fr-FR')}\n\n`;

  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    for (const msg of sorted.values()) {
      if (msg.author.bot && !msg.embeds.length) continue;
      const content = msg.content || (msg.embeds[0]?.description ?? '[embed]');
      transcript += `[${msg.createdAt.toLocaleString('fr-FR')}] ${msg.author.tag}: ${content}\n`;
    }
  } catch (e) {
    transcript += '(Impossible de récupérer tous les messages)\n';
  }

  // Envoie le transcript en MP à l'utilisateur si possible
  try {
    const ownerId = channel.topic?.match(/ID: (\d+)/)?.[1];
    if (ownerId) {
      const member = await channel.guild.members.fetch(ownerId).catch(() => null);
      if (member) {
        const buffer = Buffer.from(transcript, 'utf-8');
        const attachment = new AttachmentBuilder(buffer, {
          name: `transcript-${channel.name}.txt`,
        });
        await member.send({
          content: 'Voici le transcript de ton ticket :',
          files: [attachment],
        }).catch(() => {});
      }
    }
  } catch {}

  // Nettoie la mémoire
  conversations.delete(channel.id);

  await channel.send('🔒 Fermeture du ticket dans 5 secondes...');
  setTimeout(() => {
    channel.delete().catch(() => {});
  }, 5000);
}

// ==================== EVENTS ====================
client.once('ready', async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  await registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  try {
    // Bouton "Ouvrir un ticket"
    if (interaction.isButton() && interaction.customId === 'open_ticket') {
      await createTicket(interaction);
      return;
    }

    // Bouton "Fermer le ticket"
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
      await interaction.deferUpdate();
      await closeTicket(interaction.channel, interaction.user);
      return;
    }

    // Slash commands
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'setup-tickets') {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('🎫 Support')
          .setDescription(
            'Besoin d\'aide ? Clique sur le bouton ci-dessous pour ouvrir un ticket.\n\nUn assistant IA te répondra automatiquement.'
          )
          .setFooter({ text: 'Support 100 % automatisé' });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('open_ticket')
            .setLabel('Ouvrir un ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📩')
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ Panneau de tickets envoyé !', ephemeral: true });
      }

      if (interaction.commandName === 'close') {
        if (!interaction.channel.name.startsWith('ticket-')) {
          return interaction.reply({
            content: '❌ Cette commande ne peut être utilisée que dans un ticket.',
            ephemeral: true,
          });
        }
        await interaction.reply({ content: 'Fermeture en cours...', ephemeral: true });
        await closeTicket(interaction.channel, interaction.user);
      }
    }
  } catch (err) {
    console.error('Erreur interaction:', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: 'Une erreur est survenue.', ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: 'Une erreur est survenue.', ephemeral: true }).catch(() => {});
    }
  }
});

// Messages dans les tickets → réponse IA
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (!message.channel.name?.startsWith('ticket-')) return;

  // Ignore les messages trop courts
  if (!message.content || message.content.trim().length < 2) return;

  // Indicateur de frappe
  await message.channel.sendTyping().catch(() => {});

  const reply = await getAIResponse(
    message.channel.id,
    message.content,
    message.author.username
  );

  // Découpe si trop long
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
