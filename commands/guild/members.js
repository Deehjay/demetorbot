const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  logCommandIssuer,
  hasAdminPrivileges,
  demetoriIcon,
} = require("../../utilities/utilities");
const Members = require("../../models/Members");
require("dotenv").config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("members")
    .setDescription("Lists members and their details")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("Show a list of members and their weapons")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("gear")
        .setDescription("Show members' gear with links to their gear")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("planners")
        .setDescription("Show members' planner links")
    ),
  async execute(interaction) {
    // Log who triggered the command
    logCommandIssuer(interaction, "members");

    const isAdmin = await hasAdminPrivileges(interaction);

    // Check if the executing user has admin privileges
    if (!isAdmin) {
      return interaction.reply({
        content: "You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      const members = await Members.find({});
      const membersByWeapons = {};

      // Group members by their weapon combinations
      members.forEach((member) => {
        const weaponCombination = member.weapons;

        // Initialize the array for this weapon combination if it doesn't exist
        if (!membersByWeapons[weaponCombination]) {
          membersByWeapons[weaponCombination] = [];
        }

        // Add the member to the appropriate weapon combination group
        membersByWeapons[weaponCombination].push(member);
      });

      let description = "";

      // Build the embed description with headings and members under each heading
      Object.keys(membersByWeapons).forEach((weaponCombination) => {
        description += `**${weaponCombination} - ${membersByWeapons[weaponCombination].length} total**\n`;

        membersByWeapons[weaponCombination].forEach((member) => {
          if (subcommand === "list") {
            description += `- ${member.inGameName}\n`;
          } else if (subcommand === "gear") {
            if (member.gear.original && member.gear.shortened) {
              description += `- ${member.inGameName}: [Gear Link](${member.gear.shortened}) (Updated: ${member.gear.lastUpdated})\n`;
            } else {
              description += `- ${member.inGameName}: No gear available\n`;
            }
          } else if (subcommand === "planners") {
            if (member.gear.plannerLink && member.gear.plannerLinkShortened) {
              description += `- ${member.inGameName}: [Planner Link](${member.gear.plannerLinkShortened})\n`;
            } else {
              description += `- ${member.inGameName}: No planner link available\n`;
            }
          }
        });

        description += "\n"; // Add extra line for separation between groups
      });

      const embed = new EmbedBuilder()
        .setColor("#3498db")
        .setTitle("Member List")
        .setDescription(description)
        .setThumbnail(demetoriIcon)
        .setAuthor({ name: "Deme", iconURL: demetoriIcon })
        .setFooter({
          text: `Total Members: ${members.length}`,
          iconURL: demetoriIcon,
        });

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      interaction.reply("There was an error retrieving the member list");
    }
  },
};
