const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  eventId: { type: String, required: true },
  channelId: { type: String, required: true },
  eventType: { type: String, required: true },
  eventName: { type: String, required: true },
  eventCreator: { type: String, required: true },
  attendingCount: { type: Number, required: true, default: 0 },
  absentCount: { type: Number, required: true, default: 0 },
  eventDetails: {
    date: { type: String, required: true },
    time: { type: String, required: true },
    dateTime: { type: Date, required: true },
    isMandatory: { type: Boolean, required: true },
  },
  responses: {
    type: [
      {
        userId: { type: String, required: true },
        name: { type: String, required: true },
        status: { type: String, required: true },
        reason: { type: String, required: false },
      },
    ],
    required: true,
    default: [],
  },
});

module.exports = mongoose.model("Event", eventSchema);
