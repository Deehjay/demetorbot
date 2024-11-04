const eventTypeChoices = [
  { name: "Field Boss", value: "Field Boss" },
  { name: "Archboss", value: "Archboss" },
  { name: "Boonstone", value: "Boonstone" },
  { name: "Riftstone", value: "Riftstone" },
  { name: "Guild Bosses", value: "Guild Bosses" },
  { name: "Castle Siege", value: "Castle Siege" },
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
];

const eventThumbnails = {
  "Field Boss":
    "https://throne-and-liberty.interactivemap.app/admin/assets/icons/WM_FB_ElderTurncoat_Target.png",
  Riftstone:
    "https://throne-and-liberty.interactivemap.app/admin/assets/icons/riftstone.png",
  Boonstone:
    "https://throne-and-liberty.interactivemap.app/admin/assets/icons/boonstone1.png",
  "Castle Siege":
    "https://throne-and-liberty.interactivemap.app/admin/assets/icons/castle.png",
  "Guild Bosses":
    "https://throne-and-liberty.interactivemap.app/admin/assets/icons/guild-base.png",
  Archboss:
    "https://throne-and-liberty.interactivemap.app/admin/assets/icons/archboss.png",
};

const eventImages = {
  "Field Boss": "https://i.imgur.com/bI3KkEx.png",
  Rifstone: "https://i.imgur.com/yuvEDiu.png",
  Boonstone: "https://i.imgur.com/hjij8nV.png",
  "Castle Siege": "https://i.imgur.com/yA34U6J.png",
  "Guild Bosses": "https://i.imgur.com/EwBHdKq.png",
  Archboss: "https://i.imgur.com/vsjnX1w.png",
};

const backupEmbedImage = "https://i.imgur.com/iNR6sxc.png";

module.exports = {
  eventTypeChoices,
  eventNameChoices,
  eventThumbnails,
  eventImages,
  backupEmbedImage,
};
