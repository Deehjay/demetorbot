const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("addroles")
    .setDescription("Adds roles to a member in the server.")
    .addUserOption((option) =>
      option
        .setName("name")
        .setDescription("Select the member")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("weapons")
        .setDescription("The weapons the member plays")
        .setRequired(true)
        .addChoices(
          { name: "SNS/GS", value: "SNS/GS" },
          { name: "STAFF/DAGGER", value: "STAFF/DAGGER" }
        )
    ),
  async execute(interaction) {
    const guild = interaction.guild;

    // Check if the executing user has admin privileges, if not then denies use of command
    const adminRole = guild.roles.cache.find(
      (role) => role.name.toLowerCase() === "new role"
    );

    if (!interaction.member.roles.cache.has(adminRole.id)) {
      return interaction.reply(
        "You do not have permission to use this command"
      );
    }

    // Find member from input
    const member = interaction.options.getUser("name");
    const memberInGuild = guild.members.cache.get(member.id);

    // Find the member role in the server
    const memberRole = guild.roles.cache.find(
      (role) => role.name.toLowerCase() === "member"
    );

    // Find the weapon role in the server
    const weaponChoice = interaction.options.getString("weapons");
    const weaponRole = guild.roles.cache.find(
      (role) => role.name.toUpperCase() === weaponChoice
    );

    // Check if roles exist
    if (!memberRole) {
      return interaction.reply("Role 'member' not found in the server.");
    }

    if (!weaponRole) {
      return interaction.reply(
        `Role '${weaponChoice}' not found in the server.`
      );
    }

    // Check if member already has roles
    if (
      memberInGuild.roles.cache.has(memberRole.id) &&
      memberInGuild.roles.cache.has(weaponRole.id)
    ) {
      return interaction.reply(
        `${member.globalName} already has member and weapon roles.`
      );
    }

    try {
      // Adding the role to the GuildMember
      await memberInGuild.roles.add(memberRole);
      await memberInGuild.roles.add(weaponRole);
      await interaction.reply(
        `Roles have been assigned to ${member.globalName}`
      );
    } catch (err) {
      console.log(err);
      await interaction.reply("There was an error assigning the roles.");
    }
  },
};
