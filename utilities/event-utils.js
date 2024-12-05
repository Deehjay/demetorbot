const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const Event = require("../models/Event");
const { eventImages, eventThumbnails, backupEmbedImage } = require("./data");
const { demetoriIcon } = require("./utilities");
const { hasAdminPrivileges } = require("./shared-utils");
const { DateTime } = require("luxon");
const { updateEventResponseInDatabase } = require("../services/event-service");

function generateEventEmbed(eventDetails) {
  const { eventName, eventType, unixTimestamp } = eventDetails;

  const thumbnailUrl = eventThumbnails[eventType] || demetoriIcon;
  const eventImageUrl = eventImages[eventType] || backupEmbedImage;

  const description = eventDetails.isMandatory
    ? "**Click the ✅ button if you're attending, or ❌ if you aren't.**\n\nThis is a **mandatory** event. If you will be absent, please respond to the bot's DM with a reason for absence."
    : "**Click the ✅ button if you're attending, or ❌ if you aren't.**\n\nThis is a **non-mandatory** event.";

  return new EmbedBuilder()
    .setColor("#00ff00")
    .setTitle(`⚔️ ${eventName} ⚔️`)
    .setDescription(description)
    .setThumbnail(thumbnailUrl)
    .setAuthor({ name: "Deme", iconURL: demetoriIcon })
    .addFields({
      name: "🕰️ Time:",
      value: `<t:${unixTimestamp}:F>`,
    })
    .setImage(eventImageUrl);
}

function generateReactionButtons(attendingCount, absentCount, isDisabled) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("event_attending")
      .setLabel(`✅ ${attendingCount}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isDisabled),
    new ButtonBuilder()
      .setCustomId("event_absent")
      .setLabel(`❌ ${absentCount}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isDisabled),
    new ButtonBuilder()
      .setCustomId("event_responses")
      .setLabel("Responses")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isDisabled)
  );
}

function generateEventConcludedEmbed(eventDetails) {
  const { eventName, eventType } = eventDetails;

  const thumbnailUrl = eventThumbnails[eventType] || demetoriIcon;
  const eventImageUrl = eventImages[eventType] || backupEmbedImage;

  return new EmbedBuilder()
    .setColor("#ff0000")
    .setTitle(`⚔️ ${eventName} ⚔️`)
    .setDescription("**This event has concluded. Registration is no longer possible.**")
    .setThumbnail(thumbnailUrl)
    .setAuthor({ name: "Deme", iconURL: demetoriIcon })
    .setImage(eventImageUrl);
}

async function generateReactionSummaryEmbed(eventDocId, attendingCount, absentCount) {
  try {
    const finalEvent = await Event.findById(eventDocId);

    const { eventName, eventType, eventDetails } = finalEvent;

    const thumbnailUrl = eventThumbnails[eventType] || demetoriIcon;

    const attendanceSummary = `**Attending (${attendingCount}):**\n${
      finalEvent.responses
        .filter((entry) => entry.status === "attending")
        .map((entry) => entry.name)
        .join("\n") || "No one"
    }\n\n**Not Attending (${absentCount}):**\n${
      finalEvent.responses
        .filter((entry) => entry.status === "not_attending")
        .map((entry) => `${entry.name} - ${entry.reason || "No reason provided"}`)
        .join("\n") || "No one"
    }`;

    return new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`**REACTION summary for ${eventName} on ${eventDetails.date}:**`)
      .setAuthor({
        name: "Deme",
        iconURL: demetoriIcon,
      })
      .setDescription(`${attendanceSummary}`)
      .setThumbnail(thumbnailUrl)
      .setFooter({
        text: `Total responses: ${finalEvent.responses.length}`,
        iconURL: demetoriIcon,
      });
  } catch (err) {
    console.error(`[Database Error] Event with ID ${eventDocId} not found.`);
    return;
  }
}

async function handleEventResponsesButton(userResponses, interaction) {
  const isAdmin = hasAdminPrivileges(interaction);

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

  if (isAdmin) {
    await interaction.guild.members.fetch();

    const respondedUserIds = new Set(userResponses.map((entry) => entry.userId));
    const allGuildMembers = interaction.guild.members.cache
      .filter((member) => member.roles.cache.has("1297834278549192735"))
      .sort((a, b) => (a.nickname || a.user.username).localeCompare(b.nickname || b.user.username));

    const unresponsiveUsers = allGuildMembers
      .filter((member) => !respondedUserIds.has(member.user.id))
      .map((member) => member.nickname || member.user.username);

    unresponsiveUsersString = unresponsiveUsers.join("\n") || "No unresponsive members";
  }

  let replyContent = `**Attending:**\n${attendingUsersString}\n\n**Not Attending:**\n${notAttendingUsersString}`;

  if (isAdmin) {
    replyContent += `\n\n**Unresponsive:**\n${unresponsiveUsersString}`;
  }

  return replyContent;
}

function generateAbsenceRequestEmbed(eventName, eventDate) {
  return new EmbedBuilder()
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
}

async function requestAbsenceReason(i, userId, dmCollectors, event) {
  try {
    // Calculate remaining duration until the event starts
    const cetDateTime = DateTime.fromISO(event.eventDetails.dateTime.toISOString()).setZone(
      "Europe/Paris"
    );
    const now = DateTime.now();
    const remainingDuration = Math.max(0, cetDateTime.diff(now).milliseconds);

    // Create DM and send embed, and generate a message collector
    const dmEmbed = generateAbsenceRequestEmbed(event.eventName, event.eventDetails.date);
    const dmChannel = await i.user.createDM();
    await dmChannel.send({ embeds: [dmEmbed] });

    const dmCollector = dmChannel.createMessageCollector({
      max: 1,
      time: remainingDuration,
      filter: (msg) => !msg.author.bot,
    });

    // Store collector in map to handle multiple DMs
    dmCollectors.set(userId, dmCollector);

    await updateEventResponseInDatabase(
      event._id,
      {
        $set: {
          "responses.$.reason": "No reason provided.",
          "responses.$.status": "not_attending",
        },
      },
      ["responses.userId", userId]
    );

    dmCollector.on("collect", async (response) => {
      const reason = response.content.trim();

      await updateEventResponseInDatabase(
        event._id,
        {
          $set: {
            "responses.$.reason": reason,
            "responses.$.status": "not_attending",
          },
        },
        ["responses.userId", userId]
      );

      await dmChannel.send("Thank you for providing a reason.");
      dmCollector.stop();
    });

    dmCollector.on("end", async (collected, reason) => {
      dmCollectors.delete(userId);
      if (reason === "switched_to_attending") return;

      if (collected.size === 0) {
        await dmChannel.send("No reason was provided within the time limit.");
      }
    });
  } catch (error) {
    console.error("Error handling DM collector:", error);
  }
}

module.exports = {
  generateEventEmbed,
  generateReactionButtons,
  generateEventConcludedEmbed,
  generateReactionSummaryEmbed,
  handleEventResponsesButton,
  generateAbsenceRequestEmbed,
  requestAbsenceReason,
};
