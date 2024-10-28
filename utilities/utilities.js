export function hasAdminPrivileges(interaction) {
  const adminRole = interaction.guild.roles.cache.find(
    (role) => role.name.toLowerCase() === "admin"
  );
  return interaction.member.roles.cache.has(adminRole.id);
}

export function logCommandIssuer(interaction, commandName) {
  const commandIssuer = interaction.user;
  console.log(`${commandName} command triggered by ${commandIssuer.tag}`);
}

export const demetoriIcon =
  "https://cdn.discordapp.com/icons/270697525789327360/161a6b89280f20d059f52926285dcafb.webp?size=240";

export const gearExample =
  "https://cdn.discordapp.com/attachments/1296209831102910508/1300402358743732254/image.png?ex=6720b592&is=671f6412&hm=26dbefc80434f936b071e4e0ee2dfd5ba6723a42a81e34757a94836f29f813ac&";
