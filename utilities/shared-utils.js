function hasAdminPrivileges(interaction) {
  const adminRole = interaction.guild.roles.cache.find(
    (role) => role.name.toLowerCase() === "officer"
  );
  return interaction.member.roles.cache.has(adminRole.id);
}

module.exports = { hasAdminPrivileges };
