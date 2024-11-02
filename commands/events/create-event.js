const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { demetoriIcon } = require("../../utilities/utilities");
const { eventNameChoices, eventTypeChoices } = require("../../utilities/data");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("create-event")
    .setDescription("Creates an event and lets members react for attendance")
    .addStringOption((option) =>
      option
        .setName("event_type")
        .setDescription("The type of event")
        .setRequired(true)
        .addChoices(...eventTypeChoices)
    )
    .addStringOption((option) =>
      option
        .setName("event_name")
        .setDescription("Name of the event")
        .setRequired(true)
        .addChoices(...eventNameChoices)
    )
    .addStringOption((option) =>
      option
        .setName("event_date")
        .setDescription("Date of the event. Must be in format DD/MM/YYYY")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("event_time")
        .setDescription(
          "Time the event takes place. Will be converted to local time for anyone viewing. HH:MM format"
        )
        .setRequired(true)
    ),
  async execute(interaction) {
    // Log who triggered the command
    logCommandIssuer(interaction, "update-gear");
    const isAdmin = await hasAdminPrivileges(interaction);
    // Check if the executing user has admin privileges
    if (!isAdmin) {
      return interaction.reply(
        "You do not have permission to use this command."
      );
    }
    const eventType = interaction.options.getString("event_type");
    const eventName = interaction.options.getString("event_name");
    const eventDate = interaction.options.getString("event_date");
    const eventTime = interaction.options.getString("event_time");

    // Validate the date format (DD/MM/YYYY)
    const dateFormat = /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/(\d{4})$/;
    if (!dateFormat.test(eventDate)) {
      return interaction.reply({
        content:
          "Please provide a valid date in DD/MM/YYYY format (e.g., 25/12/2023).",
        ephemeral: true,
      });
    }

    // Extract day, month, and year
    const [day, month, year] = eventDate.split("/").map(Number);

    // Validate time format (HH:MM)
    const timeFormat = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeFormat.test(eventTime)) {
      return interaction.reply({
        content:
          "Please provide a valid time in 24-hour format (e.g., 14:30 for 2:30 PM).",
        ephemeral: true,
      });
    }

    // Extract hours and minutes
    const [hours, minutes] = eventTime.split(":").map(Number);

    // Create a Date object using the date and time provided
    const dateObject = new Date(year, month - 1, day, hours, minutes);

    // Check if the date and time are in the future
    const now = new Date();
    if (dateObject <= now) {
      return interaction.reply({
        content: "The date and time provided must be in the future.",
        ephemeral: true,
      });
    }

    // Calculate the Unix timestamp
    const unixTimestamp = Math.floor(dateObject.getTime() / 1000);

    const eventThumbnails = {
      "World Boss":
        "https://throne-and-liberty.interactivemap.app/admin/assets/icons/WM_FB_ElderTurncoat_Target.png",
      Riftstone:
        "https://throne-and-liberty.interactivemap.app/admin/assets/icons/riftstone.png",
      Boonstone:
        "https://throne-and-liberty.interactivemap.app/admin/assets/icons/boonstone1.png",
      Siege:
        "https://throne-and-liberty.interactivemap.app/admin/assets/icons/castle.png",
      "Guild Bosses":
        "https://throne-and-liberty.interactivemap.app/admin/assets/icons/guild-base.png",
      "Arch Boss":
        "https://throne-and-liberty.interactivemap.app/admin/assets/icons/archboss.png",
    };

    const thumbnailUrl = eventThumbnails[eventType] || demetoriIcon;

    // Create the event embed
    const eventEmbed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle(`${eventType} - ${eventName}`)
      .setDescription(
        "**Click the ✅ button if you're attending, or ❌ if you aren't.**\n\nIf you will be absent, please post a message in the absence text channel."
      )
      .setThumbnail(thumbnailUrl)
      .setAuthor({ name: "Deme", iconURL: demetoriIcon })
      .addFields({
        name: "🕰️ Time:",
        value: `${eventDate} // <t:${unixTimestamp}:R>`,
      });

    // Track attendance counts and user responses
    let attendingCount = 0;
    let absentCount = 0;
    const userResponses = {}; // Track each user's response
    const notAttendingReasons = []; // Track reasons for "not attending"

    // Initialize buttons for RSVP
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("attend_event")
        .setLabel(`✅ ${attendingCount}`)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("not_attending_event")
        .setLabel(`❌ ${absentCount}`)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("responses")
        .setLabel("Responses")
        .setStyle(ButtonStyle.Primary)
    );

    // Send the initial event embed and buttons
    const message = await interaction.reply({
      embeds: [eventEmbed],
      components: [row],
      fetchReply: true,
    });

    // Calculate duration for the collector in milliseconds
    const collectorDuration = dateObject.getTime() - now.getTime();

    // Set up a button interaction collector
    const collector = message.createMessageComponentCollector({
      time: collectorDuration,
    });

    collector.on("collect", async (i) => {
      const userId = i.user.id;
      const isAttending = i.customId === "attend_event";
      const guildMember = interaction.guild.members.cache.get(userId);
      const userNickname = guildMember?.nickname || i.user.username;

      // Handle the "Responses" button click
      if (i.customId === "responses") {
        const attendingUsers =
          Object.keys(userResponses)
            .filter((userId) => userResponses[userId] === "attending")
            .map((userId) => `${userId}`)
            .join("\n") || "No one yet";
        const notAttendingUsers =
          notAttendingReasons.map((entry) => `${entry.name}`).join("\n") ||
          "No one yet";

        await i.reply({
          content: `**Attending:**\n${attendingUsers}\n\n**Not Attending:**\n${notAttendingUsers}`,
          ephemeral: true,
        });
        return;
      }

      // Check if the user is switching their response
      if (userResponses[userId] === "attending" && !isAttending) {
        attendingCount--;
        absentCount++;
      } else if (userResponses[userId] === "not_attending" && isAttending) {
        absentCount--;
        attendingCount++;
        // Remove user's reason if they switch to attending
        const index = notAttendingReasons.findIndex(
          (entry) => entry.name === userNickname
        );
        if (index !== -1) notAttendingReasons.splice(index, 1);
      } else if (!userResponses[userId]) {
        // New response, increment appropriate count
        if (isAttending) attendingCount++;
        else absentCount++;
      }

      // Update user’s response
      userResponses[userId] = isAttending ? "attending" : "not_attending";

      // If not attending and user hasn't given a reason, ask for it
      if (
        !isAttending &&
        !notAttendingReasons.some((entry) => entry.name === userNickname)
      ) {
        try {
          const dmChannel = await i.user.createDM();
          await dmChannel.send("Please provide a reason for not attending:");

          // Collect the user's response
          const dmCollector = dmChannel.createMessageCollector({
            max: 1,
            time: collectorDuration,
          });

          dmCollector.on("collect", (response) => {
            const reason = response.content.trim();
            notAttendingReasons.push({ name: userNickname, reason });
            dmChannel.send("Thank you for providing a reason.");
          });

          dmCollector.on("end", (collected) => {
            if (collected.size === 0) {
              notAttendingReasons.push({
                name: userNickname,
                reason: "No reason provided",
              });
              dmChannel.send("No reason was provided within the time limit.");
            }
          });
        } catch (error) {
          console.error("Error sending DM:", error);
        }
      }

      // Send private feedback to the user
      await i.reply({
        content: `You have selected: ${
          isAttending ? "Attending" : "Not Attending"
        }`,
        ephemeral: true,
      });

      // Update the embed with current attendance counts
      const updatedEmbed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle(`${eventType} - ${eventName}`)
        .setDescription(
          "**Click the ✅ button if you're attending, or ❌ if you aren't.**\n\nIf you will be absent, please post a message in the absence text channel."
        )
        .setThumbnail(thumbnailUrl)
        .setAuthor({ name: "Deme", iconURL: demetoriIcon })
        .addFields({
          name: "🕰️ Time:",
          value: `${eventDate} // <t:${unixTimestamp}:R>`,
        });

      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("attend_event")
          .setLabel(`✅ ${attendingCount}`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("not_attending_event")
          .setLabel(`❌ ${absentCount}`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("responses")
          .setLabel("Responses")
          .setStyle(ButtonStyle.Primary)
      );

      // Update the main message with counts only
      await message.edit({ embeds: [updatedEmbed], components: [updatedRow] });
    });

    // Handle the end of collection
    collector.on("end", async () => {
      console.log(notAttendingReasons);

      const eventConcludedEmbed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle(`${eventType} - ${eventName}`)
        .setDescription(
          "Registration is no longer available - event has passed."
        )
        .setThumbnail(thumbnailUrl)
        .setAuthor({ name: "Deme", iconURL: demetoriIcon })
        .addFields({
          name: "🕰️ Time:",
          value: `${eventDate} // <t:${unixTimestamp}:R>`,
        });

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("attend_event")
          .setLabel(`✅ ${attendingCount}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("not_attending_event")
          .setLabel(`❌ ${absentCount}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("responses")
          .setLabel("Responses")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(false) // Keep "Responses" active
      );

      await message.edit({
        components: [disabledRow],
        embeds: [eventConcludedEmbed],
      });
    });
  },
};
