require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { Client, Collection, Events, GatewayIntentBits, Partials } = require("discord.js");
const discordToken = process.env.DISCORD_TOKEN;
const mongoose = require("mongoose");
const { handleWishlistEdit } = require("./utilities/utilities");
const Member = require("./models/Member");
const { DateTime } = require("luxon");
const { handleEventResponsesButton } = require("./utilities/event-utils");
const Event = require("./models/Event");
const { fetchEventFromDatabase } = require("./services/event-service");
const { reinitialiseEventCollectors } = require("./utilities/reinitialisation");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel, Partials.GuildMember],
  allowedMentions: { parse: ["users", "roles"], repliedUser: true },
});
const mongoURI = process.env.MONGO_URI;

mongoose
  .connect(mongoURI)
  .then(() => console.log("[Database] Connected to MongoDB!"))
  .catch((err) => console.error("Failed to connect to MongoDB", err));

client.commands = new Collection();
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[Client] Ready! Logged in as ${readyClient.user.tag}`);
  await reinitialiseEventCollectors(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Autocomplete handling
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) return console.log("Command was not found");

      if (!command.autocomplete) {
        return console.error(
          `No autocomplete handler was found for the ${interaction.commandName} command.`
        );
      }

      await command.autocomplete(interaction);
      return;
    }

    // Chat input command handling
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) return console.log("Command was not found");

      await command.execute(interaction);
      return;
    }

    // Button interaction handling
    if (interaction.isButton()) {
      const [action, type, slot] = interaction.customId.split("_"); // Parse the customId
      const messageId = interaction.message.id;

      if (action === "wishlist" && type === "edit") {
        const slotNumber = parseInt(slot, 10);
        await handleWishlistEdit(interaction, slotNumber);
      }

      if (action === "event" && type === "responses") {
        await interaction.deferReply({ ephemeral: true });
        console.log(`Fetching event data for message ID ${messageId}`);
        const eventData = await fetchEventFromDatabase(messageId);
        const replyContent = await handleEventResponsesButton(eventData.responses, interaction);
        return interaction.editReply({ content: replyContent });
      }

      return;
    }

    // Select menu interaction handling
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith("wishlist_slot_")) {
        const slotNumber = parseInt(interaction.customId.split("_")[2], 10);
        const selectedItem = interaction.values[0];
        const userId = interaction.user.id;

        try {
          const member = await Member.findOne({ memberId: userId });

          if (!member) {
            return interaction.reply({
              content: "You are not registered in the database.",
              ephemeral: true,
            });
          }

          const wishlistSlot = member.wishlist.find((s) => s.slot === slotNumber);

          if (!wishlistSlot) {
            return interaction.reply({
              content: `Slot ${slotNumber} does not exist.`,
              ephemeral: true,
            });
          }

          wishlistSlot.item = selectedItem;
          // wishlistSlot.cooldownEnd = DateTime.now().plus({ weeks: 3 }).toISO();
          wishlistSlot.slotLastUpdated = DateTime.now().toISO();
          console.log(wishlistSlot.cooldownEnd);

          await member.save();

          await interaction.update({
            content: `Slot ${slotNumber} has been updated to: **${selectedItem}**.`,
            components: [],
            ephemeral: true,
          });
        } catch (error) {
          console.error("Error updating wishlist slot:", error);
          await interaction.reply({
            content: "There was an error updating your wishlist slot.",
            ephemeral: true,
          });
        }
      }
      return;
    }
  } catch (error) {
    console.error("Error handling interaction:", error);
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  try {
    const memberId = member.id;

    console.log(`[Member Left] ${member.user.tag} (${memberId}) left the server`);

    // Check if the member is registered in the database
    const existingMember = await Member.findOne({ memberId: memberId });

    if (existingMember) {
      await Member.deleteOne({ memberId: memberId });
      console.log(`[Database] Successfully deleted member with ID ${memberId} from the database.`);
    }
  } catch (error) {
    console.error(`[Database] Error deleting member from the database: ${error}`);
  }
});

client.login(discordToken);
