const { SlashCommandBuilder } = require("discord.js");
const { logCommandIssuer } = require("../../utilities/utilities");
const Member = require("../../models/Member");
const { hasAdminPrivileges } = require("../../utilities/shared-utils");

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
      return interaction.reply({
        content: "You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    // Get the member from the input
    const guild = interaction.guild;
    const member = interaction.options.getUser("user");
    const guildMember = guild.members.cache.get(member.id);

    try {
      // Find the member in db
      const databaseMember = await Member.findOne({ memberId: member.id });

      if (databaseMember) {
        await Member.deleteOne({ memberId: member.id });
      }

      const rolesToRemove = guildMember.roles.cache.filter((role) => role.name !== "@everyone");

      if (rolesToRemove.size === 0) {
        // No roles to remove
        return interaction.reply(`There are no roles to remove for ${guildMember.displayName}.`);
      }

      // Remove roles
      for (const role of rolesToRemove.values()) {
        await guildMember.roles.remove(role);
      }

      // Send success reply
      await interaction.reply(
        `:white_check_mark: Roles removed successfully for ${guildMember.displayName}.`
      );
    } catch (err) {
      console.error(err);
      interaction.reply("There was an error removing roles or database entry.");
    }
  },
};
