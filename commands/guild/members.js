const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  logCommandIssuer,
  hasAdminPrivileges,
  demetoriIcon,
} = require("../../utilities/utilities");
const Members = require("../../models/Members");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("members")
    .setDescription(
      "Lists all members with their weapons and a link to their gear"
    ),
  async execute(interaction) {
    // Log who triggered the command
    logCommandIssuer(interaction, "members");
    const isAdmin = await hasAdminPrivileges(interaction);

    // Check if the executing user has admin privileges
    if (!isAdmin) {
      return interaction.reply(
        "You do not have permission to use this command."
      );
    }

    try {
      const members = await Members.find({});

      // Group members by their weapon combinations
      const membersByWeapons = {};
      let memberListDescription = "";

      members.forEach((member) => {
        const weaponCombination = member.weapons;

        // Initialize the array for this weapon combination if it doesn't exist
        if (!membersByWeapons[weaponCombination]) {
          membersByWeapons[weaponCombination] = [];
        }

        // Add the member to the appropriate weapon combination group
        membersByWeapons[weaponCombination].push(member);
      });

      // Build the embed description with headings and members under each heading
      Object.keys(membersByWeapons).forEach((weaponCombination) => {
        memberListDescription += `**${weaponCombination} - ${membersByWeapons[weaponCombination].length} total**\n`;

        membersByWeapons[weaponCombination].forEach((member) => {
          memberListDescription += `- ${member.inGameName}`;
          if (member.gear) {
            memberListDescription += ` - [Gear](${member.gear})\n`;
          } else {
            memberListDescription += ` - No link provided for gear\n`;
          }
        });

        memberListDescription += "\n"; // Add extra line for separation between groups
      });

      const memberListEmbed = new EmbedBuilder()
        .setColor("#3498db")
        .setTitle("Member List")
        .setDescription(memberListDescription)
        .setThumbnail(demetoriIcon)
        .setAuthor({ name: "Demetorbot", iconURL: demetoriIcon })
        .setFooter({
          text: `Total Members: ${members.length}`,
          iconURL: demetoriIcon,
        });

      await interaction.reply({ embeds: [memberListEmbed] });
    } catch (err) {
      console.error(err);
      interaction.reply(
        "There was an error retrieving the member list:\n" + err
      );
    }
  },
};
