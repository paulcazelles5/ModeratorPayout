an: reply, reason: null };
  return { reason: match[1].trim(), clean: reply.replace(/\[\[ESCALATE:\s*.+?\]\]/gi, '').trim() };
}

function getFormFields(categoryId) {
  const map = {
    report_someone: [
      { id: 'target', label: 'Who are you reporting?', placeholder: 'Username or ID', required: true },
      { id: 'reason', label: 'Reason', style: 'paragraph', placeholder: 'What happened?', required: true },
      { id: 'proof', label: 'Proof / Evidence', style: 'paragraph', placeholder: 'Links, screenshots description...', required: false },
    ],
    report_bugs: [
      { id: 'bug', label: 'Bug description', style: 'paragraph', placeholder: 'What is broken?', required: true },
      { id: 'steps', label: 'Steps to reproduce', style: 'paragraph', placeholder: 'How to reproduce?', required: false },
    ],
    claim_giveaway: [
      { id: 'giveaway', label: 'Which giveaway?', placeholder: 'Prize or message link', required: true },
      { id: 'proof', label: 'Proof of win', style: 'paragraph', placeholder: 'Screenshot or details', required: true },
    ],
    host_giveaway: [
      { id: 'prize', label: 'Prize', placeholder: 'What are you giving away?', required: true },
      { id: 'duration', label: 'Duration', placeholder: 'e.g. 24h, 3d', required: true },
      { id: 'winners', label: 'Number of winners', placeholder: '1', required: true },
    ],
    start_partnership: [
      { id: 'invite', label: 'Server invite', placeholder: 'https://discord.gg/...', required: true },
      { id: 'members', label: 'Member count', placeholder: 'Approx members', required: true },
      { id: 'offer', label: 'What do you offer?', style: 'paragraph', placeholder: 'Details of partnership', required: true },
    ],
  };
  return map[categoryId] || [
    { id: 'subject', label: 'Subject', required: true },
    { id: 'description', label: 'Description', style: 'paragraph', required: true },
  ];
}

function buildCategoryModal(categoryId, label) {
  const fields = getFormFields(categoryId);
  const modal = new ModalBuilder().setCustomId(`ticket_form_${categoryId}`).setTitle(label.slice(0, 45));
  const rows = fields.slice(0, 5).map(f => {
    const input = new TextInputBuilder()
      .setCustomId(f.id)
      .setLabel(f.label.slice(0, 45))
      .setStyle(f.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(!!f.required)
      .setPlaceholder((f.placeholder || '').slice(0, 100));
    if (f.max) input.setMaxLength(f.max);
    return new ActionRowBuilder().addComponents(input);
  });
  modal.addComponents(...rows);
  return modal;
}

function extractFormData(categoryId, interaction) {
  const fields = getFormFields(categoryId);
  const out = {};
  const lines = [];
  for (const f of fields) {
    let val = '';
    try { val = interaction.fields.getTextInputValue(f.id) || ''; } catch {}
    out[f.id] = val;
    if (val) lines.push(`**${f.label}:** ${val}`);
  }
  out.formText = lines.join('\n');
  out.subject = out.target || out.bug || out.giveaway || out.prize || out.invite || out.subject || 'Ticket';
  out.description = out.formText;
  return out;
}

async function createTicket(guild, user, categoryId, interaction, formData = {}) {
  const max = data.maxTicketsPerUser || 1;
  const userTickets = Object.values(data.openTickets).filter(t => t.userId === user.id).length;
  if (userTickets >= max) {
    const msg = `You already have ${max} open ticket(s).`;
    return interaction.deferred || interaction.replied ? interaction.editReply({ content: msg }) : interaction.reply({ content: msg, ephemeral: true });
  }

  const category = data.categories.find(c => c.id === categoryId) || data.categories[0];
  data.ticketCounter = (data.ticketCounter || 0) + 1;
  const num = data.ticketCounter;

  let parent = guild.channels.cache.find(c => c.name.toLowerCase() === 'tickets' && c.type === ChannelType.GuildCategory);
  if (!parent) {
    parent = await guild.channels.create({
      name: 'Tickets', type: ChannelType.GuildCategory,
      permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }],
    });
  }

  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
  ];

  const channel = await guild.channels.create({
    name: `ticket-${String(num).padStart(4, '0')}`,
    type: ChannelType.GuildText,
    parent: parent.id,
    topic: `Ticket #${num} | ${user.tag} | ${category.label} | ID: ${user.id}`,
    permissionOverwrites: overwrites,
  });

  data.openTickets[channel.id] = {
    number: num, userId: user.id, guildId: guild.id, category: category.id,
    categoryLabel: category.label, createdAt: Date.now(), lastActivity: Date.now(), aiReplied: false,
  };
  saveData();
  conversations.set(channel.id, [{ role: 'system', content: process.env.AI_SYSTEM_PROMPT || DEFAULT_PROMPT }]);

  const formBlock = formData.formText || 'No form data.';
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`Ticket #${num} — ${category.label}`)
    .setDescription(`Welcome ${user}.\n\n**Form submitted:**\n${formBlock}\n\nStaff will assist you. AI has given its one response.`)
    .setFooter({ text: 'Payout Central Support' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('escalate_ticket').setLabel('Request Staff').setStyle(ButtonStyle.Primary),
  );

  await channel.send({ content: `${user}`, embeds: [embed], components: [row] });

  // Reply to interaction FIRST (stops thinking)
  const ok = `Ticket created: ${channel}`;
  if (interaction.deferred || interaction.replied) await interaction.editReply({ content: ok });
  else await interaction.reply({ content: ok, ephemeral: true });

  // Non-blocking AI one-shot
  if (openai && formData.formText) {
    setImmediate(async () => {
      try {
        await channel.sendTyping().catch(() => {});
        let payload = formData.formText;
        if (categoryId === 'claim_giveaway') {
          payload += '\n\n[SYSTEM] Treat claim carefully. Ask for proof and escalate for staff verification.';
        }
        const raw = await getAIResponse(channel.id, payload, user.username);
        const { clean, reason } = parseEscalate(raw);
        if (clean) await channel.send(clean).catch(() => {});
        if (reason) await channel.send(`Staff notified: ${reason}`).catch(() => {});
        if (data.openTickets[channel.id]) {
          data.openTickets[channel.id].aiReplied = true;
          saveData();
        }
      } catch (e) { console.error('AI first reply', e.message); }
    });
  }
}
