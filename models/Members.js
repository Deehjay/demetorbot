const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema({
  memberId: String,
  discordUsername: String,
  discordDisplayName: String,
  inGameName: String,
  weapons: String,
  gear: String,
});

module.exports = mongoose.model("Members", memberSchema);
