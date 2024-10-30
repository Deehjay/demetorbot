const { Storage } = require("@google-cloud/storage");
const fetch = require("node-fetch");
require("dotenv").config();

const demetoriIcon =
  "https://cdn.discordapp.com/icons/1297613705843835065/5d43638e0d29a60cb4d21079cedb0230.webp?size=240";

const gearExample =
  "https://storage.googleapis.com/demetorbot/gear_1730313823001.png";

// Initialize Google Cloud Storage and specify the bucket name
const googleCredentials = JSON.parse(
  Buffer.from(process.env.GOOGLE_CREDENTIALS, "base64")
);
const storage = new Storage({ credentials: googleCredentials });
const bucketName = "demetorbot"; // Replace with your bucket name
const bucket = storage.bucket(bucketName);

function hasAdminPrivileges(interaction) {
  const adminRole = interaction.guild.roles.cache.find(
    (role) => role.name.toLowerCase() === "officer"
  );
  return interaction.member.roles.cache.has(adminRole.id);
}

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
  const response = await fetch(discordCdnUrl);
  const arrayBuffer = await response.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);
  const fileName = `gear_${Date.now()}.png`; // Unique filename based on timestamp

  // Upload the image buffer to GCS
  const gcsLink = await uploadImageToGCS(imageBuffer, fileName);
  if (gcsLink) {
    console.log("Google Cloud Storage link:", gcsLink);
    return gcsLink;
  }
}

async function deleteScreenShotFromCloud(fileName) {
  await bucket.file(fileName).delete();
  return;
}

async function shortenUrl(url) {
  const response = await fetch(
    `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`
  );
  const responseUrl = await response.text();
  return responseUrl;
}

function getCurrentDate() {
  const today = new Date();

  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();

  return `${day}/${month}/${year}`;
}

// Export functions and constants
module.exports = {
  hasAdminPrivileges,
  logCommandIssuer,
  demetoriIcon,
  gearExample,
  processGearScreenshot,
  shortenUrl,
  getCurrentDate,
  deleteScreenShotFromCloud,
};
