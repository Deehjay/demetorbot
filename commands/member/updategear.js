const { SlashCommandBuilder, EmbedBuilder, Embed } = require("discord.js");
const Members = require("../../models/Members");
const {
  logCommandIssuer,
  hasAdminPrivileges,
  demetoriIcon,
  gearExample,
} = require("../../utilities/utilities");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("update-gear")
    .setDescription(
      "DM a member to collect their gear. Stores info in database."
    )
    .addUserOption((option) =>
      option
        .setName("name")
        .setDescription("The member to prompt for their gear.")
        .setRequired(true)
    ),
  async execute(interaction) {
    // Log who triggered the command
    logCommandIssuer(interaction);
    const isAdmin = await hasAdminPrivileges(interaction);
    // Check if the executing user has admin privileges
    if (!isAdmin) {
      return interaction.reply(
        "You do not have permission to use this command."
      );
    }
    // Get the selected member and find their nickname
    const member = interaction.options.getUser("name");
    const guildMember = interaction.guild.members.cache.get(member.id);
    const memberNickname = guildMember.nickname;

    const dmPromptEmbed = new EmbedBuilder()
      .setColor("#3498db")
      .setTitle("Gear Submission")
      .setDescription(
        "Please provide a screenshot of your current gear. Ensure it clearly shows all gear pieces and your Combat Power. An example can be seen below.\n\n" +
          "**Please either upload the image directly, or send a URL (must end in .jpg/jpeg/png) or I will not be able to process your request.**"
      )
      .setFooter({ text: "Request will time out in 10 minutes." })
      .setImage(gearExample)
      .setThumbnail(demetoriIcon)
      .setAuthor({ name: "Demetorbot", iconURL: demetoriIcon });

    // Create a DM with selected member asking for gear - inform command issuer that they have been prompted
    const dmChannel = await member.createDM();
    await dmChannel.send({ embeds: [dmPromptEmbed] });
    await interaction.reply(
      `> :timer: Prompted ${memberNickname} to send a screenshot of their gear.`
    );

    // Create a filter and message collector with a 10-minute timeout
    const filter = (response) => response.author.id === member.id; // Filter only messages for the specific member
    const messageCollector = dmChannel.createMessageCollector({
      filter,
      time: 600_000, // Time in ms (10 minutes)
    });

    messageCollector.on("collect", async (message) => {
      let imageUrl;
      // Check if the collected message contains an attachment first
      if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        const isImage =
          attachment.contentType?.startsWith("image/") ||
          /\.(jpg|jpeg|png)$/i.test(attachment.url);

        if (isImage) {
          imageUrl = attachment.url;
        }
      } else if (message.content) {
        // If collected message is not a direct attachment, see if message provided contains a link to a valid image
        const urlPattern =
          /(https?:\/\/.*\.(?:png|jpg|jpeg|bmp))|https?:\/\/(www\.)?(imgur\.com|gyazo\.com|prntscr\.com)\/[a-zA-Z0-9]+/i;
        const urlMatch = message.content.match(urlPattern);

        if (urlMatch) {
          imageUrl = urlMatch[0];
        }
      }

      // Once both checks have been made, either update member in db or send response that reply is invalid
      if (imageUrl) {
        try {
          await Members.findOneAndUpdate(
            { memberId: member.id }, // Search by member ID
            { $set: { gear: imageUrl } } // Update gear field with the image URL
          );
          messageCollector.stop("success"); // Stop the message collector after processing image and updating db
        } catch (err) {
          console.error("Database update error:", err);
          messageCollector.stop("db_error");
        }
      } else {
        dmChannel.send(
          "Reply is not valid. Please either directly upload a screenshot, or a link to a screenshot (url must contain .jpg/jpeg/png)"
        );
      }
    });

    // Handle the end of collection (including timeouts)
    messageCollector.on("end", (collected, reason) => {
      if (reason === "time") {
        interaction.followUp(
          `Listening timed out. ${memberNickname} did not respond with a screenshot of their gear in time`
        );
        dmChannel.send(
          "Listening timed out. You did not respond with a screenshot of your gear in time."
        );
      } else if (reason === "success") {
        interaction.followUp(
          `${memberNickname} has provided a link to their gear. Database has been updated.`
        );
        dmChannel.send("Thank you for providing a screenshot of your gear");
      } else if (reason === "db_error") {
        interaction.followUp(
          `There was an issue updating ${memberNickname}'s information in the database. Please check the logs for more details.`
        );
        dmChannel.send("An error occurred.");
      }
    });
  },
};
