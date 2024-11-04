const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Event = require("../../models/Event");
const { eventNameChoices, eventImages } = require("../../utilities/data");
const {
  demetoriIcon,
  logCommandIssuer,
  hasAdminPrivileges,
} = require("../../utilities/utilities");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("track-attendance")
    .setDescription("Tracks attendance for a specific event.")
    .addStringOption((option) =>
      option
        .setName("event_name")
        .setDescription("Name of the event to track attendance for")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName("event_date")
        .setDescription("Date of the event in DD/MM/YYYY format")
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
    logCommandIssuer(interaction, "track-attendance");
    const isAdmin = await hasAdminPrivileges(interaction);
    if (!isAdmin) {
      return interaction.reply({
        content: "You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    const attendanceTrackingTextChannel = interaction.guild.channels.cache.get(
      "1302717156038934528"
    );

    if (!targetChannel) {
      return interaction.reply({
        content: "Could not find the attendance log channel.",
        ephemeral: true,
      });
    }

    const eventName = interaction.options.getString("event_name");
    const eventDate = interaction.options.getString("event_date");
    const guild = interaction.guild;

    // Fetch the event from the database
    const event = await Event.findOne({
      eventName: eventName,
      "eventDetails.date": eventDate,
    });

    if (!event) {
      return interaction.reply({
        content: `No event found for **${eventName}** on **${eventDate}**.`,
        ephemeral: true,
      });
    }

    // Get the "Mandatory events" voice channel members
    const voiceChannel = interaction.guild.channels.cache.get(
      "1301604842875256924"
    );

    if (!voiceChannel) {
      return interaction.reply({
        content: "The Mandatory events voice channel could not be found.",
        ephemeral: true,
      });
    }

    // Get members in the voice channel
    const membersInVoice = voiceChannel.members.map((member) => member.user.id);

    // Get all members with the "Member" role
    const memberRole = guild.roles.cache.find((role) => role.name === "Member");
    const allMembers = await guild.members.fetch(); // Fetch all members to access roles

    const membersWithRole = allMembers.filter((member) =>
      member.roles.cache.has(memberRole.id)
    );

    // Separate responses based on conditions
    const attendingInVoice = [];
    const notAttendingInVoice = [];
    const noResponseInVoice = [];
    const attendingNotInVoice = [];
    const notAttendingNotInVoice = [];
    const noResponseNotInVoice = [];

    // Loop through event responses to categorise them
    event.responses.forEach((response) => {
      const isInVoice = membersInVoice.includes(response.userId);

      if (response.status === "attending") {
        if (isInVoice) {
          attendingInVoice.push(response.name);
        } else {
          attendingNotInVoice.push(response.name);
        }
      } else if (response.status === "not_attending") {
        if (isInVoice) {
          notAttendingInVoice.push(response.name);
        } else {
          notAttendingNotInVoice.push(
            `${response.name} - ${response.reason || "No reason provided"}`
          );
        }
      }
    });

    // Find members with "Member" role who did not respond
    const respondedUserIds = event.responses.map((response) => response.userId);

    membersWithRole.forEach((member) => {
      const userId = member.user.id;
      const userName = member.displayName || member.user.username;

      if (
        !respondedUserIds.includes(userId) &&
        !membersInVoice.includes(userId)
      ) {
        noResponseNotInVoice.push(userName);
      } else if (
        !respondedUserIds.includes(userId) &&
        membersInVoice.includes(userId)
      ) {
        noResponseInVoice.push(userName);
      }
    });

    // Create the embed message
    const attendanceEmbed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`📋 Attendance Summary for ${eventName} on ${eventDate} 📋`)
      .setThumbnail(eventImages[event.eventType])
      .setAuthor({ name: "Deme", iconURL: demetoriIcon })
      .addFields(
        {
          name: `In Voice and Responded 'Attending' (${attendingInVoice.length}):`,
          value: attendingInVoice.join("\n") || "No one",
          inline: true,
        },
        {
          name: `In Voice and Responded 'Not Attending' (${notAttendingInVoice.length}):`,
          value: notAttendingInVoice.join("\n") || "No one",
          inline: true,
        },
        {
          name: `In Voice and Didn't Respond (${noResponseInVoice.length}):`,
          value: noResponseInVoice.join("\n") || "No one",
          inline: true,
        },
        {
          name: `Not in Voice and Responded 'Attending' (${attendingNotInVoice.length}):`,
          value: attendingNotInVoice.join("\n") || "No one",
          inline: true,
        },
        {
          name: `Not in Voice and Responded 'Not Attending' (${notAttendingNotInVoice.length}):`,
          value: notAttendingNotInVoice.join("\n") || "No one",
          inline: true,
        },
        {
          name: `Not in Voice and Didn't Respond (${noResponseNotInVoice.length}):`,
          value: noResponseNotInVoice.join("\n") || "No one",
          inline: true,
        }
      );
    await attendanceTrackingTextChannel.send({ embeds: [attendanceEmbed] });
    // Send the embed to the channel
    await interaction.reply({
      content: `Attendance summary for ${eventName} on ${eventDate} posted in ${targetChannel}.`,
      ephemeral: true,
    });
  },
};
