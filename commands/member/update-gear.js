const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Member = require("../../models/Member");
const {
  demetoriIcon,
  gearExample,
  processGearScreenshot,
  shortenUrl,
  getCurrentDate,
  deleteScreenShotFromCloud,
} = require("../../utilities/utilities");
const { hasAdminPrivileges } = require("../../utilities/shared-utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("update-gear")
    .setDescription("Update your gear via screenshot.")
    .addUserOption((option) =>
      option
        .setName("name")
        .setDescription("The member to prompt for their gear.")
        .setRequired(true)
    ),
  async execute(interaction) {
    const commandIssuer = interaction.user;
    const isAdmin = await hasAdminPrivileges(interaction);
    const member = interaction.options.getUser("name");
    const guildMember = interaction.guild.members.cache.get(member.id);
    const memberNickname = guildMember.nickname || member.username;
    console.log(`[Gear Update] ${commandIssuer.username} triggered the update-gear command.`);

    // Check if the user has permission to update the specified user's gear
    if (!isAdmin) {
      const hasMemberRole = interaction.member.roles.cache.some((role) => role.name === "Member");

      if (!hasMemberRole) {
        console.log(
          `[Gear Update] ${commandIssuer.username} does not meet requirements to use update-gear command (not a member).`
        );
        return interaction.reply({
          content: "You must be a member to use this command.",
          ephemeral: true,
        });
      } else if (member.id !== commandIssuer.id) {
        console.log(
          `[Gear Update] ${memberNickname} does not meet requirements to use update-gear command (tried to use it on another member).`
        );
        return interaction.reply({
          content: "You can only update your own gear.",
          ephemeral: true,
        });
      }
    }
    console.log(`[Gear Update] Prompting ${memberNickname} to provide gear screenshot.`);

    const dmPromptEmbed = new EmbedBuilder()
      .setColor("#3498db")
      .setTitle("Gear Submission")
      .setDescription(
        "Please provide a screenshot of your current gear by replying to me in DMs. Ensure it clearly shows all gear pieces and your Combat Power. An example can be seen below.\n\n" +
          "**Please either upload the image directly, or send a URL (must end in .jpg/jpeg/png) or I will not be able to process your request.**"
      )
      .setFooter({ text: "Request will time out in 10 minutes." })
      .setImage(gearExample)
      .setThumbnail(demetoriIcon)
      .setAuthor({ name: "Demetorbot", iconURL: demetoriIcon });

    const dmChannel = await member.createDM();
    await dmChannel.send({ embeds: [dmPromptEmbed] });
    await interaction.reply({
      content: `You have been prompted to update your gear.`,
      ephemeral: true,
    });
    const botCommandsChannel = interaction.guild.channels.cache.get("1300435235577528444");
    await botCommandsChannel.send(
      `> :timer: Prompted ${memberNickname} to send a screenshot of their gear.`
    );

    const filter = (response) => response.author.id === member.id;
    const messageCollector = dmChannel.createMessageCollector({
      filter,
      time: 600_000,
    });

    messageCollector.on("collect", async (message) => {
      let imageUrl;
      console.log(`[Gear Update] Received response from ${memberNickname}.`);

      if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        const isImage =
          attachment.contentType?.startsWith("image/") || /\.(jpg|jpeg|png)$/i.test(attachment.url);

        if (isImage) {
          imageUrl = attachment.url.includes("?") ? attachment.url : attachment.proxyURL;
          console.log(`[Gear Update] ${memberNickname} provided a valid attachment.`);
        }
      } else if (message.content) {
        const urlPattern = /(https?:\/\/[^\s]+(?:png|jpg|jpeg|bmp)[^\s]*)/i;
        const urlMatch = message.content.match(urlPattern);

        if (urlMatch) {
          imageUrl = urlMatch[0];
          console.log(`[Gear Update] ${memberNickname} provided a valid URL.`);
        }
      }

      if (imageUrl) {
        try {
          const memberData = await Member.findOne({ memberId: member.id });
          if (memberData && memberData.gear && memberData.gear.original) {
            const oldFileName = memberData.gear.original.split("/").pop();
            const fileWasDeleted = await deleteScreenShotFromCloud(oldFileName);
            console.log(
              `[Gear Update] Old screenshot for ${memberNickname} ${
                fileWasDeleted ? "was deleted" : "did not exist"
              }`
            );
          }
          const uploadedGearImage = await processGearScreenshot(imageUrl);
          const shortenedGearUrl = await shortenUrl(uploadedGearImage);

          await Member.findOneAndUpdate(
            { memberId: member.id },
            {
              $set: {
                "gear.original": uploadedGearImage,
                "gear.shortened": shortenedGearUrl,
                "gear.lastUpdated": getCurrentDate(),
              },
            }
          );
          botCommandsChannel.send(
            `> ✅ ${memberNickname} has provided a link to their gear: ${shortenedGearUrl} - Database has been updated.`
          );
          console.log(`[Database] Updated gear for ${memberNickname} in the database.`);
          messageCollector.stop("success");
        } catch (err) {
          console.error(`[Database Error] Failed to update gear for ${memberNickname}:`, err);
          messageCollector.stop("db_error");
        }
      } else {
        console.log(
          `[Gear Update] Invalid response from ${memberNickname}. Prompting for correct format.`
        );
        dmChannel.send(
          "Reply is not valid. Please either directly upload a screenshot, or a link to a screenshot (url must contain .jpg/jpeg/png)"
        );
      }
    });

    messageCollector.on("end", (collected, reason) => {
      if (reason === "time") {
        console.log(`[Gear Update] Collection timed out for ${memberNickname}.`);
        botCommandsChannel.send(
          `> ❌ Listening timed out. ${memberNickname} did not respond with a screenshot of their gear in time`
        );
        dmChannel.send(
          "Listening timed out. You did not respond with a screenshot of your gear in time."
        );
      } else if (reason === "success") {
        console.log(`[Gear Update] Gear successfully updated for ${memberNickname}.`);
        dmChannel.send("Thank you for providing a screenshot of your gear! 😊");
      } else if (reason === "db_error") {
        console.log(`[Gear Update] Error updating database for ${memberNickname}.`);
        botCommandsChannel.send(
          `> ❌ There was an issue updating ${memberNickname}'s information in the database. Please check the logs for more details.`
        );
        dmChannel.send("An error occurred.");
      }
    });
  },
};
