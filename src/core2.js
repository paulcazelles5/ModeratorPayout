client.once('ready', () => {
  console.log(`[Payout Central] Logged in as ${client.user.tag}`);
  console.log('[Payout Central] Full core restored: tickets + one-shot AI + panel');
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_category') {
      const categoryId = interaction.values[0];
      const category = data.categories.find(c => c.id === categoryId);
      const needForm = data.requireForm && (category?.form !== false);
      if (needForm) {
        pendingForms.set(interaction.user.id, categoryId);
        const modal = buildCategoryModal(categoryId, category?.label || 'Ticket');
        await interaction.showModal(modal);
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      await createTicket(interaction.guild, interaction.user, categoryId, interaction);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_form_')) {
      await interaction.deferReply({ ephemeral: true });
      const categoryId = interaction.customId.replace('ticket_form_', '');
      const formData = extractFormData(categoryId, interaction);
      pendingForms.delete(interaction.user.id);
      await createTicket(interaction.guild, interaction.user, categoryId, interaction, formData);
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'close_ticket') {
        await interaction.deferUpdate();
        const ch = interaction.channel;
        if (data.openTickets[ch.id]) {
          delete data.openTickets[ch.id];
          saveData();
        }
        await ch.send('Ticket closed.').catch(() => {});
        setTimeout(() => ch.delete().catch(() => {}), 3000);
        return;
      }
      if (interaction.customId === 'escalate_ticket') {
        await interaction.reply({ content: 'Staff has been notified.', ephemeral: true });
        await interaction.channel.send(`Staff requested by ${interaction.user}.`).catch(() => {});
        return;
      }
    }
  } catch (e) {
    console.error(e);
    try {
      if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Error. Try again.', ephemeral: true });
      else await interaction.editReply({ content: 'Error. Try again.' });
    } catch {}
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  const content = message.content.trim();

  // One-shot lock: after AI replied, non-staff get no more AI replies
  if (message.channel.name?.startsWith('ticket-') && data.openTickets[message.channel.id]) {
    data.openTickets[message.channel.id].lastActivity = Date.now();
    saveData();
    const tInfo = data.openTickets[message.channel.id];
    if (tInfo.aiReplied && !isStaff(message.member) && content.length >= 2 && openai) {
      return; // silent after one-shot
    }
  }

  if (!content.startsWith(PREFIX)) return;
  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  if (command === 'ping') return message.reply('Pong! Full core online.');
  if (command === 'help') {
    return message.reply('Commands: `*panel` (create ticket panel), `*ping`. Tickets with form + one-shot AI are fully restored.');
  }
  if (command === 'panel') {
    if (!isStaff(message.member) && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Staff only.');
    }
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Payout Central Support')
      .setDescription('Select a category to open a ticket. Fill the form. AI will reply once, then staff takes over.')
      .setFooter({ text: 'No emojis • Professional support' });
    const select = new StringSelectMenuBuilder()
      .setCustomId('ticket_category')
      .setPlaceholder('Choose a category...')
      .addOptions(data.categories.map(c => ({ label: c.label, value: c.id, description: c.label })));
    return message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
  }
});

client.login(TOKEN).catch(e => { console.error('Login failed:', e.message); process.exit(1); });
