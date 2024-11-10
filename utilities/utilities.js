const { Storage } = require("@google-cloud/storage");
const mongoose = require("mongoose");
const path = require("path");
const { DateTime } = require("luxon");
const fetch = require("node-fetch");
const Event = require("../models/Event");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { eventImages, backupEmbedImage, eventThumbnails } = require("./data");
require("dotenv").config();

const demetoriIcon =
  "https://cdn.discordapp.com/icons/1297613705843835065/5d43638e0d29a60cb4d21079cedb0230.webp?size=240";

const gearExample = "https://i.imgur.com/O98wqq8.png";

const credentialsPath = path.join(__dirname, "../credentials.json");

const storage = new Storage({
  keyFilename: credentialsPath,
});
const bucketName = "demetorbot";
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
    console.log(
      `[Gear Update] Attempting to delete file from Google Cloud Storage: ${fileName}`
    );
    await bucket.file(fileName).delete();
    console.log(
      `[Gear Update] File deleted successfully from Google Cloud Storage: ${fileName}`
    );
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
    console.log(
      `[Gear Update] Uploading image to Google Cloud Storage with filename: ${fileName}`
    );
    const file = bucket.file(fileName);
    await file.save(imageBuffer, {
      metadata: {
        contentType: "image/png",
      },
      resumable: false,
    });
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    console.log(
      `[Gear Update] Image uploaded successfully. Public URL: ${publicUrl}`
    );
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

async function reinitializeEventCollectors(client) {
  console.log(
    "[Reinitialisation] Starting to reinitialize event collectors..."
  );

  const now = DateTime.now();
  const dmCollectors = new Map();

  try {
    const activeEvents = await Event.find({
      "eventDetails.dateTime": { $gt: now.toJSDate() },
    });

    if (activeEvents.length === 0) {
      console.log(
        "[Reinitialisation] No active events found for reinitialisation."
      );
      return;
    }

    console.log(
      `[Reinitialisation] Found ${activeEvents.length} active events to reinitialise.`
    );

    for (const event of activeEvents) {
      const {
        eventId,
        responses,
        eventName,
        eventDetails,
        channelId,
        eventType,
      } = event;

      const eventDocId = event._id;

      console.log(
        `[Reinitialisation] Processing event: "${eventName}" on ${eventDetails.date}.`
      );

      const channel = client.channels.cache.get(channelId);
      const thumbnailUrl = eventThumbnails[eventType] || demetoriIcon;
      const eventImageUrl = eventImages[eventType] || backupEmbedImage;

      if (!channel) {
        console.warn(`Channel with ID ${channelId} not found.`);
        continue;
      }

      let message;
      try {
        message = await channel.messages.fetch(eventId);
      } catch (error) {
        console.error(`Error fetching message with ID ${eventId}:`, error);
        continue;
      }

      const [day, month, year] = eventDetails.date.split("/").map(Number);
      const [hours, minutes] = eventDetails.time.split(":").map(Number);

      // Calculate CET datetime and Unix timestamp
      const cetDateTime = DateTime.fromObject(
        { year, month, day, hour: hours, minute: minutes },
        { zone: "Europe/Paris" }
      );
      const unixTimestamp = Math.floor(cetDateTime.toSeconds());

      let attendingCount = responses.filter(
        (res) => res.status === "attending"
      ).length;
      let absentCount = responses.filter(
        (res) => res.status === "not_attending"
      ).length;

      const collectorDuration = cetDateTime.diff(now).milliseconds;

      const collector = message.createMessageComponentCollector({
        time: collectorDuration,
      });

      console.log(
        `[Reinitialisation] Collector created for event "${eventName}" on ${eventDetails.date}, with duration ${collectorDuration}ms.`
      );

      collector.on("collect", async (i) => {
        const userId = i.user.id;
        const userNickname = i.member?.nickname || i.user.username;
        const isAttending = i.customId === "attend_event";
        const isNotAttending = i.customId === "not_attending_event";
        const isResponseButton = i.customId === "responses";

        if (isResponseButton) {
          const attendingUsers = await Promise.all(
            responses
              .filter((entry) => entry.status === "attending")
              .map(async (entry) => {
                const member = await i.guild.members.fetch(entry.userId);
                return member.nickname || member.user.username;
              })
          );

          const notAttendingUsers = await Promise.all(
            responses
              .filter((entry) => entry.status === "not_attending")
              .map(async (entry) => {
                const member = await i.guild.members.fetch(entry.userId);
                return `${member.nickname || member.user.username}`;
              })
          );

          const attendingUsersString =
            attendingUsers.join("\n") || "No one yet";
          const notAttendingUsersString =
            notAttendingUsers.join("\n") || "No one yet";

          await i.reply({
            content: `**Attending:**\n${attendingUsersString}\n\n**Not Attending:**\n${notAttendingUsersString}`,
            ephemeral: true,
          });
          return;
        }

        let existingResponse = responses.find(
          (entry) => entry.userId === userId
        );

        if (!existingResponse) {
          // Create a new response if it doesn't exist
          existingResponse = {
            name: userNickname,
            userId,
            status: isAttending ? "attending" : "not_attending",
          };
          responses.push(existingResponse);
          await Event.updateOne(
            { _id: eventDocId },
            { $push: { responses: existingResponse } }
          );

          if (isAttending) {
            attendingCount++;
          } else {
            absentCount++;
            await requestAbsenceReason(
              i,
              userId,
              userNickname,
              dmCollectors,
              eventDocId,
              cetDateTime,
              eventName,
              eventDetails.date
            );
          }
        } else if (existingResponse.status === "attending" && isNotAttending) {
          attendingCount--;
          absentCount++;
          existingResponse.status = "not_attending";
          await requestAbsenceReason(
            i,
            userId,
            userNickname,
            dmCollectors,
            eventDocId,
            cetDateTime,
            eventName,
            eventDetails.date
          );
        } else if (existingResponse.status === "not_attending" && isAttending) {
          // Update the entry to attending and clear the reason if switching from not_attending
          await Event.updateOne(
            { _id: eventDocId, "responses.userId": userId },
            { $unset: { "responses.$.reason": "" } }
          );
          await Event.updateOne(
            { _id: eventDocId, "responses.userId": userId },
            {
              $set: {
                "responses.$.status": "attending",
                "responses.$.name": userNickname,
              },
            }
          );
          absentCount--;
          attendingCount++;
          existingResponse.status = "attending";
          delete existingResponse.reason;

          const existingCollector = dmCollectors.get(userId);

          if (existingCollector) {
            existingCollector.stop("switched_to_attending");

            await i.user.send(
              "You changed your decision to attend the event. No need to respond to the previous message."
            );
            dmCollectors.delete(userId);
          }
        } else {
          await i.reply({
            content: "You have already selected this option.",
            ephemeral: true,
          });
          return;
        }

        // await Event.updateOne(
        //   { _id: eventDocId, "responses.userId": userId },
        //   {
        //     $set: {
        //       "responses.$.status": existingResponse.status,
        //       "responses.$.name": existingResponse.name,
        //     },
        //     ...(existingResponse.reason
        //       ? { $set: { "responses.$.reason": existingResponse.reason } }
        //       : { $unset: { "responses.$.reason": "" } }),
        //   }
        // );

        await i.reply({
          content: `Thank you for your response. You have selected: ${
            isAttending ? "Attending" : "Not Attending"
          }`,
          ephemeral: true,
        });

        const updatedEmbed = new EmbedBuilder()
          .setColor("#00ff00")
          .setTitle(`⚔️ ${eventName} ⚔️`)
          .setDescription(
            "**Click the ✅ button if you're attending, or ❌ if you aren't.**\n\nThis is a mandatory event. If you will be absent, please respond to the bot's DM with a reason for absence."
          )
          .setThumbnail(eventThumbnails[event.eventType] || demetoriIcon)
          .setAuthor({ name: "Deme", iconURL: demetoriIcon })
          .addFields({
            name: "🕰️ Time:",
            value: `<t:${unixTimestamp}:R>`,
          })
          .setImage(eventImages[event.eventType] || backupEmbedImage);

        const updatedRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("attend_event")
            .setLabel(`✅ ${attendingCount}`)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("not_attending_event")
            .setLabel(`❌ ${absentCount}`)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("responses")
            .setLabel("Responses")
            .setStyle(ButtonStyle.Primary)
        );

        await message.edit({
          embeds: [updatedEmbed],
          components: [updatedRow],
        });
      });

      collector.on("end", async () => {
        const eventConcludedEmbed = new EmbedBuilder()
          .setColor("#00ff00")
          .setTitle(`⚔️ ${eventName} ⚔️`)
          .setDescription(
            "Registration is no longer available - event has passed."
          )
          .setThumbnail(thumbnailUrl)
          .setAuthor({ name: "Deme", iconURL: demetoriIcon })
          .setImage(eventImageUrl);

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("attend_event")
            .setLabel(`✅ ${attendingCount}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("not_attending_event")
            .setLabel(`❌ ${absentCount}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("responses")
            .setLabel("Responses")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
        );

        await message.edit({
          components: [disabledRow],
          embeds: [eventConcludedEmbed],
        });

        const attendanceTrackingChannel = client.channels.cache.get(
          "1302717156038934528"
        );

        if (attendanceTrackingChannel) {
          // Fetch the final version of the event from the database to ensure it has the latest reasons
          const finalEvent = await Event.findById(eventDocId);
          if (!finalEvent) {
            console.error(
              `[Database Error] Event with ID ${eventDocId} not found.`
            );
            return;
          }
          const attendanceSummary = `**Attending (${attendingCount}):**\n${
            finalEvent.responses
              .filter((entry) => entry.status === "attending")
              .map((entry) => entry.name)
              .join("\n") || "No one"
          }\n\n**Not Attending (${absentCount}):**\n${
            finalEvent.responses
              .filter((entry) => entry.status === "not_attending")
              .map(
                (entry) =>
                  `${entry.name} - ${entry.reason || "No reason provided"}`
              )
              .join("\n") || "No one"
          }`;

          const attendanceEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(`**REACTION summary for ${eventName}:**`)
            .setAuthor({
              name: "Deme",
              iconURL: demetoriIcon,
            })
            .setDescription(`${attendanceSummary}`)
            .setThumbnail(eventThumbnails[event.eventType] || demetoriIcon)
            .setFooter({
              text: `Total responses: ${responses.length}`,
              iconURL: demetoriIcon,
            });

          await attendanceTrackingChannel.send({ embeds: [attendanceEmbed] });
        } else {
          console.warn(
            `Attendance tracking channel with ID ${attendanceTrackingChannel} not found.`
          );
        }
      });
    }
    console.log(
      "[Reinitialisation] Event collectors reinitialisation completed."
    );
  } catch (error) {
    console.error(
      `[Reinitialisation Error] Failed to reinitialise event collectors: ${error}`
    );
  }
}

async function requestAbsenceReason(
  i,
  userId,
  userNickname,
  dmCollectors,
  eventDocId,
  cetDateTime,
  eventName,
  eventDate
) {
  try {
    // Calculate remaining duration until the event starts
    const now = DateTime.now();
    const remainingDuration = Math.max(0, cetDateTime.diff(now).milliseconds);
    const dmEmbed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("Event Absence Request")
      .setAuthor({
        name: "Deme",
        iconURL: demetoriIcon,
      })
      .setDescription(
        `Thank you for reacting to the event. Please provide a reason for not attending ${eventName} (${eventDate}) by typing here in our DMs.\nI will be able to accept responses until the event starts.`
      )
      .setThumbnail(demetoriIcon);
    const dmChannel = await i.user.createDM();
    await dmChannel.send({ embeds: [dmEmbed] });

    const dmCollector = dmChannel.createMessageCollector({
      max: 1,
      time: remainingDuration,
      filter: (msg) => !msg.author.bot,
    });

    dmCollectors.set(userId, dmCollector);

    await Event.updateOne(
      {
        _id: eventDocId,
        "responses.userId": userId,
      },
      {
        $set: {
          "responses.$.reason": "No reason provided.",
          "responses.$.status": "not_attending",
        },
      }
    );

    dmCollector.on("collect", async (response) => {
      const reason = response.content.trim();

      const updateResult = await Event.updateOne(
        {
          _id: eventDocId,
          "responses.userId": userId,
        },
        {
          $set: {
            "responses.$.reason": reason,
            "responses.$.status": "not_attending",
          },
        }
      );

      if (updateResult.matchedCount === 0) {
        console.log("Event or response not found for updating reason.");
      } else if (updateResult.modifiedCount === 0) {
        console.log("Reason field was not modified, possibly already set.");
      }

      await dmChannel.send("Thank you for providing a reason.");
      dmCollector.stop();
    });

    dmCollector.on("end", async (collected, reason) => {
      dmCollectors.delete(userId);
      if (reason === "switched_to_attending") return;

      if (collected.size === 0) {
        await dmChannel.send("No reason was provided within the time limit.");
      }
    });
  } catch (error) {
    console.error("Error handling DM collector:", error);
  }
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
  reinitializeEventCollectors,
  requestAbsenceReason,
};
