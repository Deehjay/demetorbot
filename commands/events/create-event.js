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
  requestAbsenceReason,
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

// FIX BUG LATER - IF BOT RESTARTS WITH NO ACTIVE RESPONSES, RESPONSE DOES NOT GET ADDED TO DATABASE

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
    const eventCreator = interaction.user.username;

    console.log(
      `[Event] ${eventCreator} is creating event: ${eventName} on ${eventDate}`
    );

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
    const cetDateTime = DateTime.fromObject(
      { year, month, day, hour: hours, minute: minutes },
      { zone: "Europe/Paris" } // CET/CEST timezone
    );

    const unixTimestamp = Math.floor(cetDateTime.toSeconds());
    const now = DateTime.now(); // Now in user's local timezone
    const collectorDuration = cetDateTime.diff(now).toObject().milliseconds;

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
        value: `<t:${unixTimestamp}:R>`,
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

    // Store event in the database
    const newEvent = new Event({
      eventId: message.id,
      channelId: scheduleChannel.id,
      guildId: interaction.guildId,
      eventType,
      eventName,
      eventDetails: {
        date: eventDate,
        time: eventTime,
        dateTime: cetDateTime,
      },
      responses: userResponses,
    });
    const eventDocId = newEvent._id;

    try {
      await newEvent.save();
      console.log(
        `[Event] Event "${eventName}" on ${eventDate} created by ${eventCreator} has been saved to the database.`
      );
    } catch (error) {
      console.error(
        `[Database Error] Failed to save event "${eventName}" on ${eventDate}: ${error}`
      );
    }

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

      // Check if the user already has an existing response
      let existingResponse = userResponses.find(
        (entry) => entry.userId === userId
      );

      if (existingResponse) {
        if (existingResponse.status === "attending" && !isAttending) {
          attendingCount--;
          absentCount++;
          existingResponse.status = "not_attending";
          try {
            await Event.updateOne(
              { _id: eventDocId, "responses.userId": userId },
              {
                $set: {
                  "responses.$.status": "not_attending",
                  "responses.$.name": userNickname,
                },
              }
            );
            await requestAbsenceReason(
              i,
              userId,
              userNickname,
              dmCollectors,
              eventDocId,
              cetDateTime,
              eventName,
              eventDate
            );
          } catch (error) {
            console.error(
              `[Database Error] Failed to update response for ${userNickname}: ${error}`
            );
          }
        } else if (existingResponse.status === "not_attending" && isAttending) {
          absentCount--;
          attendingCount++;
          existingResponse.status = "attending";
          try {
            await Event.updateOne(
              { _id: eventDocId, "responses.userId": userId },
              {
                $set: {
                  "responses.$.status": "attending",
                  "responses.$.name": userNickname,
                },
                $unset: { "responses.$.reason": "" },
              }
            );
            console.log(
              `[Event] ${userNickname} switched to attending for event "${eventName}" on ${eventDate}.`
            );
          } catch (error) {
            console.error(
              `[Database Error] Failed to update event response for ${userNickname}: ${error}`
            );
          }

          const existingCollector = dmCollectors.get(userId);
          if (existingCollector) {
            existingCollector.stop("switched_to_attending");
            await i.user.send(
              "You changed your decision to attend the event. There is no need to respond to the previous message I sent now."
            );
            dmCollectors.delete(userId);
          }
        } else {
          await i.reply({
            content: "You have already selected this option.",
            ephemeral: true,
          });
        }
      } else {
        const newEntry = {
          userId: userId,
          name: userNickname,
          status: isAttending ? "attending" : "not_attending",
        };
        userResponses.push(newEntry);

        if (isAttending) {
          attendingCount++;
          await Event.updateOne(
            { _id: eventDocId },
            { $push: { responses: newEntry } }
          );
        } else {
          absentCount++;
          await Event.updateOne(
            { _id: eventDocId },
            { $push: { responses: newEntry } }
          );
          await requestAbsenceReason(
            i,
            userId,
            userNickname,
            dmCollectors,
            eventDocId,
            cetDateTime,
            eventName,
            eventDate
          );
        }
        await i.reply({
          content: `You have selected: ${
            isAttending ? "Attending" : "Not Attending"
          }`,
          ephemeral: true,
        });
      }

      console.log(
        `[Event] ${userNickname} marked as not ${
          isAttending ? "attending" : "not attending"
        } for event "${eventName}" on ${eventDate}.`
      );

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
          value: `<t:${unixTimestamp}:R>`,
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
      console.log(
        `[Event] Event "${eventName}" on ${eventDate} has ended. Collecting responses is now closed.`
      );
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

      const attendanceTrackingChannel = interaction.guild.channels.cache.get(
        "1302717156038934528"
      );

      if (attendanceTrackingChannel) {
        // Fetch the final version of the event from the database to ensure it has the latest reasons
        const finalEvent = await Event.findById(eventDocId);
        if (!finalEvent) {
          console.error(
            `[Database Error] Event with ID ${eventDocId} not found.`
          );
          return;
        }
        const attendanceSummary = `**Attending (${attendingCount}):**\n${
          finalEvent.responses
            .filter((entry) => entry.status === "attending")
            .map((entry) => entry.name)
            .join("\n") || "No one"
        }\n\n**Not Attending (${absentCount}):**\n${
          finalEvent.responses
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
    });
  },
};
