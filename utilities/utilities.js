const { Storage } = require("@google-cloud/storage");
const path = require("path");
const { DateTime } = require("luxon");
const fetch = require("node-fetch");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const { wishlistItemChoices } = require("./data");
require("dotenv").config();
const Member = require("../models/Member");

const demetoriIcon =
  "https://cdn.discordapp.com/icons/1297613705843835065/5d43638e0d29a60cb4d21079cedb0230.webp?size=240";

const gearExample = "https://i.imgur.com/O98wqq8.png";

const credentialsPath = path.join(__dirname, "../credentials.json");

const storage = new Storage({
  keyFilename: credentialsPath,
});
const bucketName = "demetorbot";
const bucket = storage.bucket(bucketName);

function logCommandIssuer(interaction, commandName) {
  const commandIssuer = interaction.user;
  console.log(`${commandName} command triggered by ${commandIssuer.tag}`);
}

// Function to upload image buffer to Google Cloud Storage
async function uploadImageToGCS(imageBuffer, fileName) {
  const file = bucket.file(fileName);

  try {
    await file.save(imageBuffer, {
      contentType: "image/png", // Adjust based on the image type
    });
    console.log(`Image uploaded to ${file.name}`);
    return `https://storage.googleapis.com/${bucketName}/${fileName}`;
  } catch (error) {
    console.error("Error uploading to Google Cloud Storage:", error);
    return null;
  }
}

// Main function to download from Discord and upload to GCS
async function processGearScreenshot(discordCdnUrl) {
  try {
    console.log(`[Gear Update] Fetching image from Discord CDN URL`);
    const response = await fetch(discordCdnUrl);
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    const fileName = `gear_${Date.now()}.png`;
    console.log(
      `[Gear Update] Processing image and uploading to Google Cloud Storage with filename: ${fileName}`
    );

    // Upload the image buffer to GCS
    const gcsLink = await uploadImageToGCS(imageBuffer, fileName);
    if (gcsLink) {
      return gcsLink;
    } else {
      console.warn(
        `[Gear Update] Failed to obtain a link from Google Cloud Storage for filename: ${fileName}`
      );
    }
  } catch (error) {
    console.error(
      `[Gear Update] Error processing screenshot from Discord CDN URL: ${discordCdnUrl}`,
      error
    );
    throw error;
  }
}

async function deleteScreenShotFromCloud(fileName) {
  try {
    console.log(`[Gear Update] Attempting to delete file from Google Cloud Storage: ${fileName}`);

    const file = bucket.file(fileName);
    const [exists] = await file.exists();

    if (!exists) {
      console.log(`[Gear Update] File not found in Google Cloud Storage: ${fileName}`);
      return false; // Exit if the file doesn't exist
    }

    await file.delete();
    console.log(`[Gear Update] File deleted successfully from Google Cloud Storage: ${fileName}`);
    return true;
  } catch (error) {
    console.error(
      `[Gear Update] Error deleting file from Google Cloud Storage: ${fileName}`,
      error
    );
    throw error;
  }
}

async function shortenUrl(url) {
  try {
    console.log(`[Url Shorten] Attempting to shorten URL: ${url}`);
    const response = await fetch(
      `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`
    );
    const responseUrl = await response.text();
    console.log(`[Url Shorten] URL shortened successfully: ${responseUrl}`);
    return responseUrl;
  } catch (error) {
    console.error(`[Url Shorten] Error shortening URL: ${url}`, error);
    throw error;
  }
}

// Assuming this function exists to upload images to Google Cloud Storage
async function uploadImageToGCS(imageBuffer, fileName) {
  try {
    console.log(`[Gear Update] Uploading image to Google Cloud Storage with filename: ${fileName}`);
    const file = bucket.file(fileName);
    await file.save(imageBuffer, {
      metadata: {
        contentType: "image/png",
      },
      resumable: false,
    });
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    console.log(`[Gear Update] Image uploaded successfully. Public URL: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error(
      `[Gear Update] Error uploading image to Google Cloud Storage with filename: ${fileName}`,
      error
    );
    throw error;
  }
}

function getCurrentDate() {
  const today = new Date();

  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();

  return `${day}/${month}/${year}`;
}

async function handleWishlistEdit(interaction, slotNumber) {
  try {
    const userId = interaction.user.id;
    const member = await Member.findOne({ memberId: userId });
    const now = DateTime.now();

    if (!member) {
      return interaction.reply({
        content: "You are not registered in the database.",
        ephemeral: true,
      });
    }

    const wishlistSlot = member.wishlist.find((s) => s.slot === slotNumber);
    if (wishlistSlot.cooldownEnd && DateTime.fromISO(wishlistSlot.cooldownEnd) > now) {
      return interaction.reply({
        content: "This slot is still on cooldown.",
        ephemeral: true,
      });
    }

    // Pagination setup
    const itemsPerPage = 25;
    let currentPage = 0;

    const createSelectMenu = (page) => {
      const pageItems = wishlistItemChoices.slice(page * itemsPerPage, (page + 1) * itemsPerPage);
      return new StringSelectMenuBuilder()
        .setCustomId(`wishlist_slot_${slotNumber}_page_${page}`)
        .setPlaceholder(`Select an item for Slot ${slotNumber}`)
        .addOptions(
          pageItems.map((item) => ({
            label: item,
            value: item,
          }))
        );
    };

    const createPaginationButtons = (currentPage) => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`prev_page_${slotNumber}`)
          .setLabel("Previous")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId(`next_page_${slotNumber}`)
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary)
          .setDisabled((currentPage + 1) * itemsPerPage >= wishlistItemChoices.length)
      );
    };

    const updateInteraction = async () => {
      await interaction.editReply({
        content: `Select an item for Slot ${slotNumber}:`,
        components: [
          new ActionRowBuilder().addComponents(createSelectMenu(currentPage)),
          createPaginationButtons(currentPage),
        ],
      });
    };

    await interaction.reply({
      content: `Select an item for Slot ${slotNumber}:`,
      components: [
        new ActionRowBuilder().addComponents(createSelectMenu(currentPage)),
        createPaginationButtons(currentPage),
      ],
      ephemeral: true,
    });

    const collector = interaction.channel.createMessageComponentCollector({
      filter: (i) =>
        i.user.id === interaction.user.id &&
        (i.customId.startsWith("wishlist_slot") ||
          i.customId.startsWith("prev_page") ||
          i.customId.startsWith("next_page")),
      time: 60000,
    });

    collector.on("collect", async (componentInteraction) => {
      if (componentInteraction.customId.startsWith("wishlist_slot")) {
        const selectedItem = componentInteraction.values[0];
        wishlistSlot.item = selectedItem;
        wishlistSlot.slotLastUpdated = now.plus({ days: 1 }).toISO();
        member.lastWishlistUpdate = now.toISO();
        await member.save();

        await interaction.editReply({
          content: `Slot ${slotNumber} has been updated to: **${selectedItem}**.`,
          components: [],
        });

        collector.stop();
      } else if (componentInteraction.customId.startsWith("prev_page")) {
        currentPage -= 1;
        await updateInteraction();
        await componentInteraction.deferUpdate();
      } else if (componentInteraction.customId.startsWith("next_page")) {
        currentPage += 1;
        await updateInteraction();
        await componentInteraction.deferUpdate();
      }
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        interaction.editReply({
          content: "You did not select an item in time.",
          components: [],
        });
      }
    });
  } catch (error) {
    console.error("Error handling wishlist edit with pagination:", error);
    await interaction.reply({
      content: "There was an error processing your request.",
      ephemeral: true,
    });
  }
}

// Export functions and constants
module.exports = {
  logCommandIssuer,
  demetoriIcon,
  gearExample,
  processGearScreenshot,
  shortenUrl,
  getCurrentDate,
  deleteScreenShotFromCloud,
  handleWishlistEdit,
};
