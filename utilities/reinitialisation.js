const { DateTime } = require("luxon");
const Event = require("../models/Event");
const { updateEventResponseInDatabase } = require("../services/event-service");
const {
  generateReactionButtons,
  generateEventConcludedEmbed,
  requestAbsenceReason,
  generateReactionSummaryEmbed,
} = require("./event-utils");

async function reinitialiseEventCollectors(client) {
  console.log("[Reinitialisation] Starting to reinitialize event collectors...");

  const now = DateTime.now();
  const dmCollectors = new Map();

  try {
    const activeEvents = await Event.find({
      "eventDetails.dateTime": { $gt: now.toJSDate() },
    });

    if (activeEvents.length === 0) {
      console.log("[Reinitialisation] No active events found for reinitialisation.");
      return;
    }

    console.log(`[Reinitialisation] Found ${activeEvents.length} active events to reinitialise.`);

    for (const event of activeEvents) {
      const { eventId, responses, eventName, eventDetails, channelId, eventType } = event;
      const { isMandatory, date } = event.eventDetails;
      const eventDocId = event._id;

      console.log(`[Reinitialisation] Processing event: "${eventName}" on ${eventDetails.date}.`);

      const channel = client.channels.cache.get(channelId);

      if (!channel) {
        console.warn(`Channel with ID ${channelId} not found.`);
        continue;
      }

      let message;
      try {
        message = await channel.messages.fetch(eventId);
      } catch (error) {
        console.error(`Error fetching message with ID ${eventId}:`, error);
        continue;
      }

      const cetDateTime = DateTime.fromISO(eventDetails.dateTime.toISOString()).setZone(
        "Europe/Paris"
      );

      let attendingCount = responses.filter((res) => res.status === "attending").length;
      let absentCount = responses.filter((res) => res.status === "not_attending").length;
      const eventEmbedDetails = {
        eventName,
        eventType,
        unixTimestamp: Math.floor(cetDateTime.toSeconds()),
        isMandatory,
      };

      const collectorDuration = cetDateTime.diff(now).milliseconds;

      const reactionCollector = message.createMessageComponentCollector({
        time: collectorDuration,
      });

      console.log(
        `[Reinitialisation] Collector created for event "${eventName}" on ${eventDetails.date}, with duration ${collectorDuration}ms.`
      );

      // Reaction collection to listen for attending or not attending responses
      reactionCollector.on("collect", async (i) => {
        if (i.customId === "event_responses") return;

        await i.deferReply({ ephemeral: true });

        const userId = i.user.id;
        const isAttending = i.customId === "event_attending";
        const userNickname = i.member?.nickname || i.user.username;

        // Check if the user already has an existing response
        let existingResponse = responses.find((entry) => entry.userId === userId);

        if (existingResponse) {
          // If member is changing from attending to not attending
          if (existingResponse.status === "attending" && !isAttending) {
            await i.editReply({
              content: `You have selected: Not Attending for event "${eventName}" on ${date}.`,
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
                await requestAbsenceReason(i, userId, dmCollectors, event);
              }
            } catch (error) {
              console.error(
                `[Database Error] Failed to update response for ${userNickname}: ${error}`
              );
            }
            // If member is changing from not attending to attending
          } else if (existingResponse.status === "not_attending" && isAttending) {
            await i.editReply({
              content: `You have selected: Attending for event "${eventName}" on ${date}.`,
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
                `[Event] ${userNickname} switched to attending for event "${eventName}" on ${date}.`
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
          responses.push(newEntry);

          await updateEventResponseInDatabase(eventDocId, { $push: { responses: newEntry } });

          isAttending ? attendingCount++ : absentCount++;

          if (isMandatory && !isAttending) {
            await requestAbsenceReason(i, userId, dmCollectors, event);
          }

          // Responds to the user with their initial selection
          if (i.customId === "event_attending" || i.customId === "event_absent") {
            await i.editReply({
              content: `You have selected: ${
                isAttending
                  ? `Attending for event "${eventName}" on ${date}.`
                  : `Not Attending for event "${eventName}" on ${date}.`
              }`,
            });
          }
        }

        console.log(
          `[Event] ${userNickname} marked as ${
            isAttending ? "attending" : "not attending"
          } for event "${eventName}" on ${date}.`
        );

        // Update message with updated reaction counts
        const updatedReactionButtonsRow = generateReactionButtons(
          attendingCount,
          absentCount,
          false
        );
        await message.edit({ components: [updatedReactionButtonsRow] });
      });

      reactionCollector.on("end", async () => {
        console.log(
          `[Event] Event "${eventName}" on ${date} has ended. Collecting responses is now closed.`
        );

        // When event concludes, update the message with reactions disabled
        const eventConcludedEmbed = generateEventConcludedEmbed(eventEmbedDetails);
        const disabledReactionButtonsRow = generateReactionButtons(
          attendingCount,
          absentCount,
          true
        );

        await message.edit({
          components: [disabledReactionButtonsRow],
          embeds: [eventConcludedEmbed],
        });

        // If event is mandatory, generate a summary of reactions and send it to the attendance-tracking channel
        if (isMandatory) {
          const attendanceTrackingChannel = client.channels.cache.get("1302717156038934528");

          if (attendanceTrackingChannel) {
            const reactionSummaryEmbed = await generateReactionSummaryEmbed(
              eventDocId,
              attendingCount,
              absentCount
            );

            console.log(reactionSummaryEmbed);

            await attendanceTrackingChannel.send({ embeds: [reactionSummaryEmbed] });
          }
        }
      });
    }
  } catch (error) {
    console.error(`[Reinitialisation Error] Failed to reinitialise event collectors: ${error}`);
  }
}

module.exports = { reinitialiseEventCollectors };
