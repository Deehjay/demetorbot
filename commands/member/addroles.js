const {
  hasAdminPrivileges,
  logCommandIssuer,
} = require("../../utilities/utilities.js");
const { SlashCommandBuilder } = require("discord.js");
const Members = require("../../models/Members");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("add-roles")
    .setDescription("Adds roles to a member in the server.")
    .addUserOption((option) =>
      option
        .setName("name")
        .setDescription("Select the member")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("weapon1")
        .setDescription("Select the first weapon")
        .setRequired(true)
        .addChoices(
          { name: "SNS", value: "SNS" },
          { name: "GS", value: "GS" },
          { name: "BOW", value: "BOW" },
          { name: "STAFF", value: "STAFF" },
          { name: "WAND", value: "WAND" },
          { name: "DAGGER", value: "DAGGER" },
          { name: "XBOW", value: "XBOW" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("weapon2")
        .setDescription("Select the second weapon")
        .setRequired(true)
        .addChoices(
          { name: "SNS", value: "SNS" },
          { name: "GS", value: "GS" },
          { name: "BOW", value: "BOW" },
          { name: "STAFF", value: "STAFF" },
          { name: "WAND", value: "WAND" },
          { name: "DAGGER", value: "DAGGER" },
          { name: "XBOW", value: "XBOW" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("ign")
        .setDescription(
          "Enter the member's name to update their nickname in the server to their IGN."
        )
        .setRequired(true)
    ),
  async execute(interaction) {
    // Log who triggered the command
    logCommandIssuer(interaction, "add-roles");

    const guild = interaction.guild;
    const isAdmin = await hasAdminPrivileges(interaction);

    // Check if the executing user has admin privileges
    if (!isAdmin) {
      return interaction.reply({
        content: "You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    // Get the member from the input
    const member = interaction.options.getUser("name");
    const guildMember = guild.members.cache.get(member.id);
    const newNickname = interaction.options.getString("ign");

    // Find the member role in the server
    const memberRole = guild.roles.cache.find(
      (role) => role.name.toLowerCase() === "member"
    );

    // Get the primary and secondary weapons from the input
    const weaponOne = interaction.options.getString("weapon1");
    const weaponTwo = interaction.options.getString("weapon2");

    // Create two possible role combinations (primary/secondary and secondary/primary)
    const weaponCombo1 = `${weaponOne}/${weaponTwo}`.toUpperCase();
    const weaponCombo2 = `${weaponTwo}/${weaponOne}`.toUpperCase();

    // Find the correct weapon role based on both combinations
    let weaponRole = guild.roles.cache.find(
      (role) => role.name.toUpperCase() === weaponCombo1
    );

    if (!weaponRole) {
      weaponRole = guild.roles.cache.find(
        (role) => role.name.toUpperCase() === weaponCombo2
      );
    }

    // Check if the member already has the roles
    if (
      guildMember.roles.cache.has(memberRole.id) &&
      guildMember.roles.cache.has(weaponRole.id)
    ) {
      return interaction.reply(
        `${newNickname} already has the 'member' and '${weaponRole.name}' roles.`
      );
    }

    try {
      // Assign roles to the member
      await guildMember.roles.add(memberRole);
      await guildMember.roles.add(weaponRole);

      // Change nickname in server
      await guildMember
        .setNickname(newNickname, "Needed a new nickname")
        .then((member) =>
          console.log(`Set nickname of ${member.user.username}`)
        )
        .catch(console.error);

      // Check if the member exists in the database
      let databaseMember = await Members.findOne({ memberId: member.id });

      // If not, create a new member entry in the database
      if (!databaseMember) {
        databaseMember = new Members({
          memberId: member.id,
          discordUsername: member.username,
          discordDisplayName: member.globalName,
          inGameName: newNickname,
          weapons: weaponRole.name,
          gear: { original: "", shortened: "", lastUpdated: "" },
        });

        // Save the new member to the database
        await databaseMember.save();
      } else {
        console.log("Member already exists in the database");
      }

      await interaction.reply(
        `Roles have been assigned to ${member.globalName} and they have been added to the database. Their nickname has also been updated to their IGN (${newNickname})`
      );
    } catch (err) {
      await interaction.reply("There was an error assigning the roles.");
      console.error(err);
    }
  },
};
