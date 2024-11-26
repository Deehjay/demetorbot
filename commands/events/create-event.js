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
  eventChannelLookup,
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
    )
    .addStringOption((option) =>
      option
        .setName("requirement_type")
        .setDescription("Is this event mandatory or non-mandatory?")
        .setRequired(true)
        .addChoices(
          { name: "Mandatory", value: "Mandatory" },
          { name: "Non-mandatory", value: "Non-mandatory" }
        )
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
    const requirementType = interaction.options.getString("requirement_type");
    const isMandatory =
      interaction.options.getString("requirement_type") === "Mandatory";
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
    const [hours, minutes] = eventTime.split(":").map(Number);
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
    const embedDescription = isMandatory
      ? "**Click the ✅ button if you're attending, or ❌ if you aren't.**\n\nThis is a **mandatory** event. If you will be absent, please respond to the bot's DM with a reason for absence."
      : "**Click the ✅ button if you're attending, or ❌ if you aren't.**\n\nThis is a **non-mandatory** event.";

    const eventEmbed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle(`⚔️ ${eventName} ⚔️`)
      .setDescription(embedDescription)
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

    // <@&1297834278549192735> - Member
    const messageMentionString = `**NEW ${
      isMandatory ? "MANDATORY" : "NON-MANDATORY"
    } EVENT:**\n`;

    const scheduleChannel = interaction.guild.channels.cache.get(
      eventChannelLookup[requirementType]
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
      content: messageMentionString,
      embeds: [eventEmbed],
      components: [row],
      fetchReply: true,
    });

    // Store event in the database
    const newEvent = new Event({
      eventId: message.id,
      channelId: scheduleChannel.id,
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
      await i.deferReply({ ephemeral: true });

      const userId = i.user.id;
      const isAttending = i.customId === "attend_event";
      const guildMember = interaction.guild.members.cache.get(userId);
      const userNickname = guildMember?.nickname || i.user.username;

      if (i.customId === "responses") {
        const isOfficer = guildMember.roles.cache.some(
          (role) => role.name === "Officer"
        );

        const attendingUsersString =
          userResponses
            .filter((entry) => entry.status === "attending")
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((entry) => `${entry.name}`)
            .join("\n") || "No one yet";

        const notAttendingUsersString =
          userResponses
            .filter((entry) => entry.status === "not_attending")
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((entry) => `${entry.name}`)
            .join("\n") || "No one yet";

        let unresponsiveUsersString = "";

        if (isOfficer) {
          const respondedUserIds = new Set(
            userResponses.map((entry) => entry.userId)
          );
          const allGuildMembers = interaction.guild.members.cache
            .filter((member) => !member.user.bot)
            .sort((a, b) =>
              (a.nickname || a.user.username).localeCompare(
                b.nickname || b.user.username
              )
            );

          const unresponsiveUsers = allGuildMembers
            .filter((member) => !respondedUserIds.has(member.user.id))
            .map((member) => member.nickname || member.user.username);

          unresponsiveUsersString =
            unresponsiveUsers.join("\n") || "No unresponsive members";
        }

        let replyContent = `**Attending:**\n${attendingUsersString}\n\n**Not Attending:**\n${notAttendingUsersString}`;

        if (isOfficer) {
          replyContent += `\n\n**Unresponsive:**\n${unresponsiveUsersString}`;
        }

        await i.editReply({
          content: replyContent,
        });
        return;
      }

      // Check if the user already has an existing response
      let existingResponse = userResponses.find(
        (entry) => entry.userId === userId
      );

      if (existingResponse) {
        if (existingResponse.status === "attending" && !isAttending) {
          await i.editReply({
            content: `You have selected: Not Attending for event "${eventName}" on ${eventDate}.`,
          });
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
            if (isMandatory) {
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
          } catch (error) {
            console.error(
              `[Database Error] Failed to update response for ${userNickname}: ${error}`
            );
          }
        } else if (existingResponse.status === "not_attending" && isAttending) {
          await i.editReply({
            content: `You have selected: Attending for event "${eventName}" on ${eventDate}.`,
          });
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

          if (isMandatory) {
            const existingCollector = dmCollectors.get(userId);
            if (existingCollector) {
              existingCollector.stop("switched_to_attending");
              await i.user.send(
                "You changed your decision to attend the event. There is no need to respond to the previous message I sent now."
              );
              dmCollectors.delete(userId);
            }
          }
        } else {
          await i.editReply({
            content: "You have already selected this option.",
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

          if (isMandatory) {
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
        }
        if (
          i.customId === "attend_event" ||
          i.customId === "not_attending_event"
        ) {
          console.log("here");

          await i.editReply({
            content: `You have selected: ${
              isAttending
                ? `Attending for event "${eventName}" on ${eventDate}.`
                : `Not Attending for event "${eventName}" on ${eventDate}.`
            }`,
          });
        }
      }

      console.log(
        `[Event] ${userNickname} marked as ${
          isAttending ? "attending" : "not attending"
        } for event "${eventName}" on ${eventDate}.`
      );

      const updatedEmbed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle(`⚔️ ${eventName} ⚔️`)
        .setDescription(embedDescription)
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

      if (isMandatory) {
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
      }
    });
  },
};
