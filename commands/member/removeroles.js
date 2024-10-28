const { SlashCommandBuilder } = require("discord.js");
const {
  logCommandIssuer,
  hasAdminPrivileges,
} = require("../../utilities/utilities");
const Members = require("../../models/Members");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remove-roles")
    .setDescription(
      "Removes member and weapon roles from a user, and removes their info from the database."
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Select the user to remove roles from")
        .setRequired(true)
    ),
  async execute(interaction) {
    // Log who triggered the command
    logCommandIssuer(interaction, "remove-roles");
    const isAdmin = await hasAdminPrivileges(interaction);

    // Check if the executing user has admin privileges
    if (!isAdmin) {
      return interaction.reply(
        "You do not have permission to use this command."
      );
    }

    // Get the member from the input
    const guild = interaction.guild;
    const member = interaction.options.getUser("user");
    const guildMember = guild.members.cache.get(member.id);

    try {
      // Find the member in db
      const databaseMember = await Members.findOne({ memberId: member.id });

      if (databaseMember) {
        const roleArr = [
          guild.roles.cache.find(
            (role) => role.name.toLowerCase() === "member"
          ),
          guild.roles.cache.find(
            (role) => role.name === databaseMember.weapons
          ),
        ];

        await guildMember.roles.remove(roleArr);
        await Members.deleteOne({ memberId: member.id });
        await interaction.reply(
          ":white_check_mark: Roles and database entry removed successfully."
        );
      } else {
        await interaction.reply("User does not exist in the database");
      }
    } catch (err) {
      console.error(err);
      interaction.reply("There was an error removing roles or database entry.");
    }
  },
};
