const { SlashCommandBuilder } = require("discord.js");
const { eventNameChoices, eventTypeChoices, eventChannelLookup } = require("../../utilities/data");
const { DateTime } = require("luxon");
const {
  generateEventEmbed,
  generateReactionButtons,
  generateEventConcludedEmbed,
  requestAbsenceReason,
  generateReactionSummaryEmbed,
} = require("../../utilities/event-utils");
const { validateDateFormat, validateTimeFormat } = require("../../utilities/validation");
const {
  saveEventToDatabase,
  updateEventResponseInDatabase,
} = require("../../services/event-service");
const { hasAdminPrivileges } = require("../../utilities/shared-utils");

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
        .setDescription("Time the event takes place. HH:MM format and must be CET time")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("requirement_type")
        .setDescription("Is this event mandatory or non-mandatory?")
        .setRequired(true)
        .addChoices(
          { name: "Mandatory", value: "Mandatory" },
          { name: "Non-mandatory", value: "Non-mandatory" },
          { name: "test", value: "test" }
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
    if (!hasAdminPrivileges(interaction)) {
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
    const isMandatory = requirementType === "Mandatory" || requirementType === "test";
    const eventCreator = interaction.user.username;

    console.log(`[Event] ${eventCreator} is creating event: ${eventName} on ${eventDate}`);

    if (!validateDateFormat(eventDate)) {
      return interaction.reply({
        content: "Please provide a valid date in DD/MM/YYYY format (e.g., 25/12/2023).",
        ephemeral: true,
      });
    }

    if (!validateTimeFormat(eventTime)) {
      return interaction.reply({
        content: "Please provide a valid time in 24-hour format (e.g., 14:30 for 2:30 PM).",
        ephemeral: true,
      });
    }

    // Convert date and time to CET timezone for creating events, as most members are in
    // European timezone.
    const [day, month, year] = eventDate.split("/").map(Number);
    const [hours, minutes] = eventTime.split(":").map(Number);

    const cetDateTime = DateTime.fromObject(
      { year, month, day, hour: hours, minute: minutes },
      { zone: "Europe/Paris" } // CET/CEST timezone
    );

    const now = DateTime.now();
    const reactionCollectorDuration = cetDateTime.diff(now).toObject().milliseconds;

    if (reactionCollectorDuration <= 0) {
      return interaction.reply({
        content: "The date and time provided must be in the future.",
        ephemeral: true,
      });
    }

    let attendingCount = 0;
    let absentCount = 0;
    const userResponses = [];

    const eventEmbedDetails = {
      eventName,
      eventType,
      unixTimestamp: Math.floor(cetDateTime.toSeconds()),
      isMandatory,
    };

    const eventEmbed = generateEventEmbed(eventEmbedDetails);
    const reactionButtonsRow = generateReactionButtons(attendingCount, absentCount, false);

    const scheduleChannel = interaction.guild.channels.cache.get(
      eventChannelLookup[requirementType]
    );
    // <@&1297834278549192735> - Member
    const message = await scheduleChannel.send({
      content: `<@&1297834278549192735> **NEW ${
        isMandatory ? "MANDATORY" : "NON-MANDATORY"
      } EVENT:**\n`,
      embeds: [eventEmbed],
      components: [reactionButtonsRow],
      fetchReply: true,
    });

    // Store event in the database
    const newEvent = await saveEventToDatabase({
      eventId: message.id,
      channelId: scheduleChannel.id,
      eventType,
      eventName,
      eventCreator,
      attendingCount,
      absentCount,
      eventDetails: {
        date: eventDate,
        time: eventTime,
        dateTime: cetDateTime,
        isMandatory: isMandatory,
      },
      responses: userResponses,
    });
    const eventDocId = newEvent._id;

    // Informs command issuer that even hast been posted successfully
    await interaction.reply({
      content: `Event has been created and posted: ${eventName} on ${eventDate}.`,
    });

    // Create a message component collector to listen for reactions
    const reactionCollector = message.createMessageComponentCollector({
      time: reactionCollectorDuration,
    });

    const dmCollectors = new Map();

    // Reaction collection to listen for attending or not attending responses
    reactionCollector.on("collect", async (i) => {
      if (i.customId === "event_responses") return;

      await i.deferReply({ ephemeral: true });

      const userId = i.user.id;
      const isAttending = i.customId === "event_attending";
      const guildMember = interaction.guild.members.cache.get(userId);
      const userNickname = guildMember?.nickname || i.user.username;

      // Check if the user already has an existing response
      let existingResponse = userResponses.find((entry) => entry.userId === userId);

      if (existingResponse) {
        // If member is changing from attending to not attending
        if (existingResponse.status === "attending" && !isAttending) {
          await i.editReply({
            content: `You have selected: Not Attending for event "${eventName}" on ${eventDate}.`,
          });

          attendingCount--;
          absentCount++;
          existingResponse.status = "not_attending";

          try {
            await updateEventResponseInDatabase(
              eventDocId,
              {
                $set: { "responses.$.status": "not_attending" },
              },
              ["responses.userId", userId]
            );
            // If event is mandatory, request reason for absence
            if (isMandatory) {
              await requestAbsenceReason(i, userId, dmCollectors, newEvent);
            }
          } catch (error) {
            console.error(
              `[Database Error] Failed to update response for ${userNickname}: ${error}`
            );
          }
          // If member is changing from not attending to attending
        } else if (existingResponse.status === "not_attending" && isAttending) {
          await i.editReply({
            content: `You have selected: Attending for event "${eventName}" on ${eventDate}.`,
          });
          absentCount--;
          attendingCount++;
          existingResponse.status = "attending";
          try {
            await updateEventResponseInDatabase(
              eventDocId,
              {
                $set: {
                  "responses.$.status": "attending",
                  "responses.$.name": userNickname,
                },
                $unset: {
                  "responses.$.reason": "",
                },
              },
              ["responses.userId", userId]
            );

            console.log(
              `[Event] ${userNickname} switched to attending for event "${eventName}" on ${eventDate}.`
            );
          } catch (error) {
            console.error(
              `[Database Error] Failed to update event response for ${userNickname}: ${error}`
            );
          }
          // If event was mandatory and user is switching to attending, stop the absence reason collector
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
        // Create a new response entry if user is responding to the event for the first time
        const newEntry = {
          userId: userId,
          name: userNickname,
          status: isAttending ? "attending" : "not_attending",
        };
        userResponses.push(newEntry);

        await updateEventResponseInDatabase(eventDocId, { $push: { responses: newEntry } });

        isAttending ? attendingCount++ : absentCount++;

        if (isMandatory && !isAttending) {
          await requestAbsenceReason(i, userId, dmCollectors, newEvent);
        }

        // Responds to the user with their initial selection
        if (i.customId === "event_attending" || i.customId === "event_absent") {
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

      // Update message with updated reaction counts
      const updatedReactionButtonsRow = generateReactionButtons(attendingCount, absentCount, false);
      await message.edit({ components: [updatedReactionButtonsRow] });
    });

    reactionCollector.on("end", async () => {
      console.log(
        `[Event] Event "${eventName}" on ${eventDate} has ended. Collecting responses is now closed.`
      );

      // When event concludes, update the message with reactions disabled
      const eventConcludedEmbed = generateEventConcludedEmbed(eventEmbedDetails);
      const disabledReactionButtonsRow = generateReactionButtons(attendingCount, absentCount, true);

      await message.edit({
        components: [disabledReactionButtonsRow],
        embeds: [eventConcludedEmbed],
      });

      // If event is mandatory, generate a summary of reactions and send it to the attendance-tracking channel
      if (isMandatory) {
        const attendanceTrackingChannel =
          interaction.guild.channels.cache.get("1302717156038934528");

        if (attendanceTrackingChannel) {
          const reactionSummaryEmbed = await generateReactionSummaryEmbed(
            eventDocId,
            attendingCount,
            absentCount
          );

          await attendanceTrackingChannel.send({ embeds: [reactionSummaryEmbed] });
        }
      }
    });
  },
};
