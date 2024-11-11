require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Partials,
} = require("discord.js");
const discordToken = process.env.DISCORD_TOKEN;
const mongoose = require("mongoose");
const { reinitializeEventCollectors } = require("./utilities/utilities");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel],
  allowedMentions: { parse: ["users", "roles"], repliedUser: true },
});
const mongoURI = process.env.MONGO_URI;

mongoose
  .connect(mongoURI)
  .then(() => console.log("[Database] Connected to MongoDB."))
  .catch((err) => console.error("Failed to connect to MongoDB", err));

client.commands = new Collection();
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));
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
  await reinitializeEventCollectors(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) return console.log("Command was not found");

    if (!command.autocomplete)
      return console.error(
        `No autocomplete handler was found for the ${interaction.commandName} command.`
      );

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(error);
    }
  }

  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) return console.log("Command was not found");

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  }
});

client.login(discordToken);
