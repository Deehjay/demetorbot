const eventTypeChoices = [
  { name: "Field Boss", value: "Field Boss" },
  { name: "Archboss", value: "Archboss" },
  { name: "Boonstone", value: "Boonstone" },
  { name: "Riftstone", value: "Riftstone" },
  { name: "Guild Bosses", value: "Guild Bosses" },
  { name: "Castle Siege", value: "Castle Siege" },
  { name: "Guild Event", value: "Guild Event" },
  { name: "Tax Delivery", value: "Tax Delivery" },
];

const eventNameChoices = [
  // Conflict and Peace
  { name: "Conflict Boss", value: "Conflict Boss" },
  { name: "Adentus (Conflict)", value: "Adentus (Conflict)" },
  { name: "Ahzreil (Conflict)", value: "Ahzreil (Conflict)" },
  { name: "Aridus (Conflict)", value: "Aridus (Conflict)" },
  { name: "Chernobog (Conflict)", value: "Chernobog (Conflict)" },
  { name: "Cornelius (Conflict)", value: "Cornelius (Conflict)" },
  { name: "Excavator-9 (Conflict)", value: "Excavator-9 (Conflict)" },
  { name: "Grand Aelon (Conflict)", value: "Grand Aelon (Conflict)" },
  { name: "Junobote (Conflict)", value: "Junobote (Conflict)" },
  { name: "Kowazan (Conflict)", value: "Kowazan (Conflict)" },
  { name: "Minezerok (Conflict)", value: "Minezerok (Conflict)" },
  { name: "Nirma (Conflict)", value: "Nirma (Conflict)" },
  { name: "Queen Bellandir (Conflict)", value: "Queen Bellandir (Conflict)" },
  { name: "Queen Bellandir (Peace)", value: "Queen Bellandir (Peace)" },
  { name: "Talus (Conflict)", value: "Talus (Conflict)" },
  { name: "Tevent (Conflict)", value: "Tevent (Conflict)" },
  { name: "Tevent (Peace)", value: "Tevent (Peace)" },

  // Boonstones
  {
    name: "Abandoned Stonemason Town Boonstone",
    value: "Abandoned Stonemason Town Boonstone",
  },
  { name: "Akidu Valley Boonstone", value: "Akidu Valley Boonstone" },
  { name: "Blackhowl Plains Boonstone", value: "Blackhowl Plains Boonstone" },
  { name: "Carmine Forest Boonstone", value: "Carmine Forest Boonstone" },
  { name: "Fonos Basin Boonstone", value: "Fonos Basin Boonstone" },
  {
    name: "Golden Rye Pastures Boonstone",
    value: "Golden Rye Pastures Boonstone",
  },
  { name: "Greyclaw Forest Boonstone", value: "Greyclaw Forest Boonstone" },
  { name: "Manawastes Boonstone", value: "Manawastes Boonstone" },
  {
    name: "Monolith Wastelands Boonstone",
    value: "Monolith Wastelands Boonstone",
  },
  { name: "Moonlight Desert Boonstone", value: "Moonlight Desert Boonstone" },
  { name: "Nesting Grounds Boonstone", value: "Nesting Grounds Boonstone" },
  { name: "Purelight Hill Boonstones", value: "Purelight Hill Boonstones" },
  { name: "Ruins of Turayne Boonstone", value: "Ruins of Turayne Boonstone" },
  { name: "Sandworm Lair Boonstone", value: "Sandworm Lair Boonstone" },
  { name: "Shattered Temple Boonstone", value: "Shattered Temple Boonstone" },
  { name: "The Raging Wilds Boonstone", value: "The Raging Wilds Boonstone" },
  { name: "Urstella Fields Boonstone", value: "Urstella Fields Boonstone" },
  { name: "Windhill Shores Boonstone", value: "Windhill Shores Boonstone" },

  // Riftstones
  { name: "Adentus Riftstone", value: "Adentus Riftstone" },
  { name: "Ahzreil Riftstone", value: "Ahzreil Riftstone" },
  { name: "Chernobog Rifstone", value: "Chernobog Rifstone" },
  { name: "Excavator-9 Riftstone", value: "Excavator-9 Riftstone" },
  { name: "Grand Aelon Riftstone", value: "Grand Aelon Riftstone" },
  { name: "Kowazan Riftstone", value: "Kowazan Riftstone" },
  { name: "Malakar Riftstone", value: "Malakar Riftstone" },
  { name: "Morokai Rifstone", value: "Morokai Rifstone" },
  { name: "Talus Riftstone", value: "Talus Riftstone" },

  // Guild Bosses
  { name: "All Guild Bosses", value: "All Guild Bosses" },

  // Castle Siege
  { name: "Castle Siege", value: "Castle Siege" },

  // Tax Delivery
  { name: "Tax Delivery", value: "Tax Delivery" },

  // Guild Event
  { name: "Guild Event", value: "Guild Event" },
];

const eventThumbnails = {
  "Field Boss":
    "https://throne-and-liberty.interactivemap.app/admin/assets/icons/WM_FB_ElderTurncoat_Target.png",
  Riftstone: "https://throne-and-liberty.interactivemap.app/admin/assets/icons/riftstone.png",
  Boonstone: "https://throne-and-liberty.interactivemap.app/admin/assets/icons/boonstone1.png",
  "Castle Siege": "https://throne-and-liberty.interactivemap.app/admin/assets/icons/castle.png",
  "Guild Bosses": "https://throne-and-liberty.interactivemap.app/admin/assets/icons/guild-base.png",
  Archboss: "https://throne-and-liberty.interactivemap.app/admin/assets/icons/archboss.png",
  "Guild Event":
    "https://throne-and-liberty.interactivemap.app/admin/assets/icons/dynamic-event.png",
  "Tax Delivery":
    "https://throne-and-liberty.interactivemap.app/admin/assets/icons/tax-collector1.png",
};

const eventImages = {
  "Field Boss": "https://i.imgur.com/bI3KkEx.png",
  Riftstone: "https://i.imgur.com/yuvEDiu.png",
  Boonstone: "https://i.imgur.com/hjij8nV.png",
  "Castle Siege": "https://i.imgur.com/yA34U6J.png",
  "Guild Bosses": "https://i.imgur.com/EwBHdKq.png",
  Archboss: "https://i.imgur.com/vsjnX1w.png",
  "Guild Event": "https://i.imgur.com/vGxe6B7.png",
  "Tax Delivery": "https://i.imgur.com/ka4Yz55.png",
};

const backupEmbedImage = "https://i.imgur.com/iNR6sxc.png";

const guildOptions = [
  { name: "Guild 1", value: "1308011055875624961" },
  { name: "Guild 2", value: "1308011121801953311" },
];

const guildLookup = {
  "1308011055875624961": "Guild 1",
  "1308011121801953311": "Guild 2",
  "1297834278549192735": "Member",
};

const eventChannelLookup = {
  Mandatory: "1302006182155915396",
  "Non-mandatory": "1311058683622330419",
  test: "1312183863673622558",
};

const weaponOptions = [
  { name: "SNS", value: "SNS" },
  { name: "GS", value: "GS" },
  { name: "BOW", value: "BOW" },
  { name: "STAFF", value: "STAFF" },
  { name: "WAND", value: "WAND" },
  { name: "DAGGER", value: "DAGGER" },
  { name: "XBOW", value: "XBOW" },
];

const wishlistItemChoices = [
  "Adentus's Gargantuan Greatsword",
  "Aridus's Gnarled Voidstaff",
  "Ascendend Guardian Pants",
  "Band of Universal Power",
  "Belt of Bloodlust",
  "Blessed Templar Cloak",
  "Chernobog's Blade of Beheading",
  "Collar of Decimation",
  "Ebon Roar Gauntlets",
  "Excavator's Mysterious Scepter",
  "Forsaken Embrace",
  "Gauntlets of the Field General",
  "Helm of the Field General",
  "Junobote's Juggernaut Warblade",
  "Kowazan's Twilight Daggers",
  "Nirma's Sword of Echos",
  "Phantom Wolf Greaves",
  "Phantom Wolf Mask",
  "Shadow Harvester Boots",
  "Shadow Harvester Mask",
  "Shadow Harvester Trousers",
  "Shock Commander Greaves",
  "Shock Commander Sabatons",
  "Shock Commander Visor",
  "Swirling Essence Robe",
  "Talus's Crystalline Staff",
  "Wrapped Coin Necklace",
];

module.exports = {
  eventTypeChoices,
  eventNameChoices,
  eventThumbnails,
  eventImages,
  backupEmbedImage,
  guildOptions,
  weaponOptions,
  guildLookup,
  eventChannelLookup,
  wishlistItemChoices,
};
