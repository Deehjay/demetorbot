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
  wishlist: [
    {
      item: String,
      slot: Number,
      cooldownEnd: String,
      slotLastUpdated: String,
    },
  ],
  group: { type: String },
  guild: { type: String },
  guildRoleId: { type: String },
});

module.exports = mongoose.model("Member", memberSchema);
