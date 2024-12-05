const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const Member = require("../../models/Member");
const { DateTime } = require("luxon");
const { demetoriIcon } = require("../../utilities/utilities");
const { backupEmbedImage } = require("../../utilities/data");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wishlist")
    .setDescription("View and update your item wishlist."),
  async execute(interaction) {
    const memberId = interaction.user.id;

    try {
      const member = await Member.findOne({ memberId });

      if (!member) {
        return interaction.reply({
          content: "You are not registered in the system.",
          ephemeral: true,
        });
      }

      const now = DateTime.now();

      // Check if the user has updated their wishlist in the last 24 hours
      //   if (
      //     member.lastWishlistUpdate &&
      //     DateTime.fromJSDate(member.lastWishlistUpdate).plus({ days: 1 }) > now
      //   ) {
      //     return interaction.reply({
      //       content:
      //         "You can only update your wishlist once per day. Try again later.",
      //       ephemeral: true,
      //     });
      //   }

      // Generate the wishlist embed
      const wishlistEmbed = new EmbedBuilder()
        .setTitle(`${member.inGameName}'s Wishlist`)
        .setColor("#3498db")
        .setDescription(
          `Here is an overview of your current item wishlist. Please use the buttons below to edit individual slots. When you edit a slot, you can not update that slot again for 1 day, so please ensure you select the correct item.\n\n${member.wishlist
            .map((slot) => {
              const cooldownRemaining = slot.cooldownEnd
                ? DateTime.fromJSDate(slot.cooldownEnd) > now
                  ? ` (Cooldown: <t:${Math.floor(
                      DateTime.fromJSDate(slot.cooldownEnd).toSeconds()
                    )}:R>)`
                  : ""
                : "";

              return `**Slot ${slot.slot}:** ${slot.item || "Empty"}${cooldownRemaining}`;
            })
            .join("\n")}
        `
        )
        .setThumbnail(demetoriIcon)
        .setAuthor({ name: "Deme", iconURL: demetoriIcon })
        .setImage("https://i.imgur.com/vjXPzod.png");

      const buttons = new ActionRowBuilder();

      // Create buttons for each slot
      for (let i = 1; i <= 5; i++) {
        const slot = member.wishlist.find((s) => s.slot === i);

        const isOnCooldown =
          DateTime.fromISO(slot.cooldownEnd) > now ||
          DateTime.fromISO(slot.slotLastUpdated).plus({ days: 1 }) > now;

        console.log(DateTime.fromISO(slot.slotLastUpdated).plus({ days: 1 }));

        buttons.addComponents(
          new ButtonBuilder()
            .setCustomId(`wishlist_edit_${i}`)
            .setLabel(`Edit Slot ${i}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(isOnCooldown)
        );
      }

      await interaction.reply({
        content: "Check your DM to view and update your wishlist.",
        ephemeral: true,
      });

      // Send the wishlist in DM
      const dmChannel = await interaction.user.createDM();
      await dmChannel.send({
        embeds: [wishlistEmbed],
        components: [buttons],
      });
    } catch (err) {
      console.error(err);
      interaction.reply("There was an error retrieving your wishlist.");
    }
  },
};
