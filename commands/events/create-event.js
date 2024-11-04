const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const {
  demetoriIcon,
  logCommandIssuer,
  hasAdminPrivileges,
} = require("../../utilities/utilities");
const {
  eventNameChoices,
  eventTypeChoices,
  eventImages,
  backupEmbedImage,
  eventThumbnails,
} = require("../../utilities/data");
const Event = require("../../models/Event");
const { DateTime } = require("luxon");

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
        .setAutocomplete(true)
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
          "Time the event takes place. HH:MM format and must be CET time"
        )
        .setRequired(true)
    ),
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const filtered = eventNameChoices.filter((choice) =>
      choice.name.toLowerCase().includes(focusedValue)
    );

    await interaction.respond(
      filtered.slice(0, 25).map((choice) => ({
        name: choice.name,
        value: choice.value,
      }))
    );
  },
  async execute(interaction) {
    logCommandIssuer(interaction, "create-event");
    const isAdmin = await hasAdminPrivileges(interaction);
    if (!isAdmin) {
      return interaction.reply({
        content: "You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    const eventType = interaction.options.getString("event_type");
    const eventName = interaction.options.getString("event_name");
    const eventDate = interaction.options.getString("event_date");
    const eventTime = interaction.options.getString("event_time");

    const dateFormat = /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/(\d{4})$/;
    if (!dateFormat.test(eventDate)) {
      return interaction.reply({
        content:
          "Please provide a valid date in DD/MM/YYYY format (e.g., 25/12/2023).",
        ephemeral: true,
      });
    }

    const [day, month, year] = eventDate.split("/").map(Number);
    const timeFormat = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeFormat.test(eventTime)) {
      return interaction.reply({
        content:
          "Please provide a valid time in 24-hour format (e.g., 14:30 for 2:30 PM).",
        ephemeral: true,
      });
    }
    // Parsing and converting user-entered time to CET
    const [hours, minutes] = eventTime.split(":").map(Number);
    // Create date object in UTC to ensure consistent base timezone handling
    // Convert the event to CET by interpreting the user’s input as local time
    // Create a DateTime object based on user's input, assuming it's in their local time zone
    const localDateObject = DateTime.fromObject(
      { year, month, day, hour: hours, minute: minutes },
      { zone: "local" } // Local to the user’s system timezone
    );

    const utcDateString = localDateObject.toUTC().toFormat("yyyy-MM-dd");
    const utcTimeString = localDateObject.toUTC().toFormat("HH:mm");
    const unixTimestamp = Math.floor(localDateObject.toSeconds());
    const now = DateTime.now(); // Now in user's local timezone
    const collectorDuration = localDateObject.diff(now).toObject().milliseconds;

    if (collectorDuration <= 0) {
      return interaction.reply({
        content: "The date and time provided must be in the future.",
        ephemeral: true,
      });
    }

    const thumbnailUrl = eventThumbnails[eventType] || demetoriIcon;
    const eventImageUrl = eventImages[eventType] || backupEmbedImage;

    const eventEmbed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle(`⚔️ ${eventName} ⚔️`)
      .setDescription(
        "**Click the ✅ button if you're attending, or ❌ if you aren't.**\n\nThis is a mandatory event. If you will be absent, please respond to the bot's DM with a reason for absence."
      )
      .setThumbnail(thumbnailUrl)
      .setAuthor({ name: "Deme", iconURL: demetoriIcon })
      .addFields({
        name: "🕰️ Time:",
        value: `${eventDate} // <t:${unixTimestamp}:R>`,
      })
      .setImage(eventImageUrl);

    let attendingCount = 0;
    let absentCount = 0;
    const userResponses = [];
    const dmCollectors = new Map();
    const memberRole = interaction.guild.roles.cache.find(
      (role) => role.name === "Member"
    );
    const memberMention = memberRole
      ? `<@&${memberRole.id}> **NEW EVENT:**\n`
      : "";
    const scheduleChannel = interaction.guild.channels.cache.get(
      "1302006182155915396"
    );

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

    const message = await scheduleChannel.send({
      content: memberMention,
      embeds: [eventEmbed],
      components: [row],
      fetchReply: true,
    });

    await interaction.reply({
      content: `Event has been created and posted: ${eventName} on ${eventDate}.`,
    });

    const collector = message.createMessageComponentCollector({
      time: collectorDuration,
    });

    collector.on("collect", async (i) => {
      const userId = i.user.id;
      const isAttending = i.customId === "attend_event";
      const guildMember = interaction.guild.members.cache.get(userId);
      const userNickname = guildMember?.nickname || i.user.username;

      if (i.customId === "responses") {
        const attendingUsersString =
          userResponses
            .filter((entry) => entry.status === "attending")
            .map((entry) => `${entry.name}`)
            .join("\n") || "No one yet";

        const notAttendingUsersString =
          userResponses
            .filter((entry) => entry.status === "not_attending")
            .map((entry) => `${entry.name}`)
            .join("\n") || "No one yet";

        await i.reply({
          content: `**Attending:**\n${attendingUsersString}\n\n**Not Attending:**\n${notAttendingUsersString}`,
          ephemeral: true,
        });
        return;
      }

      const existingResponse = userResponses.find(
        (entry) => entry.name === userNickname
      );

      if (existingResponse) {
        if (existingResponse.status === "attending" && !isAttending) {
          attendingCount--;
          absentCount++;
          existingResponse.status = "not_attending";
          await requestAbsenceReason(i, userNickname, collectorDuration);
        } else if (existingResponse.status === "not_attending" && isAttending) {
          absentCount--;
          attendingCount++;
          existingResponse.status = "attending";
          delete existingResponse.reason;

          const existingCollector = dmCollectors.get(userNickname);
          if (existingCollector) {
            existingCollector.stop("switched_to_attending");
            await i.user.send(
              "You changed your decision to attend the event. There is no need to respond to the previous message I sent now."
            );
            dmCollectors.delete(userNickname);
          }
        }
      } else {
        const newEntry = {
          name: userNickname,
          status: isAttending ? "attending" : "not_attending",
        };
        userResponses.push(newEntry);

        if (isAttending) attendingCount++;
        else {
          absentCount++;
          await requestAbsenceReason(i, userNickname, collectorDuration);
        }
      }

      await i.reply({
        content: `Thank you for your response. You have selected: ${
          isAttending ? "Attending" : "Not Attending"
        }`,
        ephemeral: true,
      });

      const updatedEmbed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle(`⚔️ ${eventName} ⚔️`)
        .setDescription(
          "**Click the ✅ button if you're attending, or ❌ if you aren't.**\n\nThis is a mandatory event. If you will be absent, please respond to the bot's DM with a reason for absence."
        )
        .setThumbnail(thumbnailUrl)
        .setAuthor({ name: "Deme", iconURL: demetoriIcon })
        .addFields({
          name: "🕰️ Time:",
          value: `${eventDate} // <t:${unixTimestamp}:F>`,
        })
        .setImage(eventImageUrl);

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

      await message.edit({ embeds: [updatedEmbed], components: [updatedRow] });
    });

    collector.on("end", async () => {
      const eventConcludedEmbed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle(`⚔️ ${eventName} ⚔️`)
        .setDescription(
          "Registration is no longer available - event has passed."
        )
        .setThumbnail(thumbnailUrl)
        .setAuthor({ name: "Deme", iconURL: demetoriIcon })
        .setImage(eventImageUrl);

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
          .setDisabled(true)
      );

      await message.edit({
        components: [disabledRow],
        embeds: [eventConcludedEmbed],
      });

      const attendanceTrackingChannel = interaction.guild.channels.cache.find(
        (channel) => channel.name === "🤖┃attendance-tracking"
      );

      if (attendanceTrackingChannel) {
        const attendanceSummary = `**Attending (${attendingCount}):**\n${
          userResponses
            .filter((entry) => entry.status === "attending")
            .map((entry) => entry.name)
            .join("\n") || "No one"
        }\n\n**Not Attending (${absentCount}):**\n${
          userResponses
            .filter((entry) => entry.status === "not_attending")
            .map(
              (entry) =>
                `${entry.name} - ${entry.reason || "No reason provided"}`
            )
            .join("\n") || "No one"
        }`;

        const attendanceEmbed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle(`**REACTION summary for ${eventName} on ${eventDate}:**`)
          .setAuthor({
            name: "Deme",
            iconURL: demetoriIcon,
          })
          .setDescription(`${attendanceSummary}`)
          .setThumbnail(thumbnailUrl)
          .setFooter({
            text: `Total responses: ${userResponses.length}`,
            iconURL: demetoriIcon,
          });

        await attendanceTrackingChannel.send({ embeds: [attendanceEmbed] });
      }

      try {
        const eventId = message.id;

        const newEvent = new Event({
          eventId: eventId,
          eventType: eventType,
          eventName: eventName,
          eventDetails: {
            date: utcDateString,
            time: utcTimeString,
          },
          responses: userResponses,
        });

        await newEvent.save();
      } catch (err) {
        console.log("Error adding event to the database: ", err);
      }
    });

    async function requestAbsenceReason(i, userNickname, collectorDuration) {
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle("Event Absence Request")
          .setAuthor({
            name: "Deme",
            iconURL: demetoriIcon,
          })
          .setDescription(
            `Thank you for reacting to the event. Please provide a reason for not attending ${eventName} (${eventDate}) by typing here in our DMs.\nI will be able to accept responses until the event starts.`
          )
          .setThumbnail(demetoriIcon);

        const dmChannel = await i.user.createDM();
        await dmChannel.send({ embeds: [dmEmbed] });

        const dmCollector = dmChannel.createMessageCollector({
          time: collectorDuration,
          filter: (msg) => !msg.author.bot,
        });

        dmCollectors.set(userNickname, dmCollector);

        dmCollector.on("collect", async (response) => {
          if (response.content.trim() && !response.attachments.size) {
            const reason = response.content.trim();
            const user = userResponses.find(
              (entry) => entry.name === userNickname
            );
            if (user) user.reason = reason;
            dmChannel.send("Thank you for providing a reason.");
            await dmCollector.stop();
          } else {
            dmChannel.send("Please respond with a text message only.");
          }
        });

        dmCollector.on("end", (collected, reason) => {
          dmCollectors.delete(userNickname);
          if (reason === "switched_to_attending") return;

          const user = userResponses.find(
            (entry) => entry.name === userNickname
          );
          if (collected.size === 0 && user) {
            user.reason = "No reason provided";
            dmChannel.send("No reason was provided within the time limit.");
          }
        });
      } catch (error) {
        console.error("Error sending DM:", error);
      }
    }
  },
};
