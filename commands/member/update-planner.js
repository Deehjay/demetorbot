const { SlashCommandBuilder } = require("discord.js");
const Member = require("../../models/Member");
const { shortenUrl } = require("../../utilities/utilities");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("update-planner")
    .setDescription("Update your Questlog.gg planner link")
    .addStringOption((option) =>
      option
        .setName("planner_link")
        .setDescription("Link to your Questlog.gg planner.")
        .setRequired(true)
    ),
  async execute(interaction) {
    const commandIssuer = interaction.user;
    const memberNickname = interaction.member.displayName || commandIssuer.username;
    const plannerLink = interaction.options.getString("planner_link");
    console.log(`[Planner Update] ${memberNickname} triggered the update-gear command.`);

    const hasMemberRole = interaction.member.roles.cache.some((role) => role.name === "Member");
    if (!hasMemberRole) {
      console.log(
        `[Planner Update] ${memberNickname} does not meet requirements to use update-planner command (not a member).`
      );
      return interaction.reply({
        content: "You must be a member to use this command.",
        ephemeral: true,
      });
    }
    // Validate that the link is specifically for the character-builder page on questlog.gg
    const questlogRegex =
      /^https:\/\/(www\.)?questlog\.gg\/throne-and-liberty\/en\/character-builder\/[a-zA-Z0-9-]+(\?build-id=\d+)?$/;

    if (!questlogRegex.test(plannerLink)) {
      console.log(
        `[Planner Update] ${memberNickname} provided an invalid Questlog character builder link.`
      );
      return interaction.reply({
        content:
          "Please provide a valid Questlog.gg link to the character builder page (must start with 'https://questlog.gg/throne-and-liberty/en/character-builder/').",
        ephemeral: true,
      });
    }

    const botCommandsChannel = interaction.guild.channels.cache.get("1300435235577528444");

    try {
      const shortenedQuestlogLink = await shortenUrl(plannerLink);
      await Member.findOneAndUpdate(
        { memberId: commandIssuer.id },
        {
          $set: {
            "gear.plannerLink": plannerLink,
            "gear.plannerLinkShortened": shortenedQuestlogLink,
          },
        },
        { upsert: true }
      );

      console.log(`[Planner Update] Successfully updated planner link for ${memberNickname}.`);

      await botCommandsChannel.send(
        `> ✅ ${memberNickname} has updated their planner link: ${shortenedQuestlogLink} - Database updated.`
      );

      interaction.reply({
        content: "✅ Your Questlog.gg character builder link has been successfully updated.",
        ephemeral: true,
      });
    } catch (error) {
      console.error(`[Database Error] Failed to update planner link for ${memberNickname}:`, error);
      await botCommandsChannel.send(
        `> ❌ There was an error updating the planner link for ${memberNickname}`
      );
      interaction.reply({
        content: "❌ An error occurred while updating your planner link. Please try again later.",
        ephemeral: true,
      });
    }
  },
};
