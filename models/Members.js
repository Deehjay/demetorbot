const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema({
  memberId: String,
  discordUsername: String,
  discordDisplayName: String,
  inGameName: String,
  weapons: String,
  gear: {
    original: String,
    shortened: String,
    lastUpdated: String,
    plannerLink: String,
    plannerLinkShortened: String,
  },
  wishlist: Array,
});

module.exports = mongoose.model("Members", memberSchema);
