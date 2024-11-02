const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  eventId: { type: String, required: true },
  eventType: { type: String, required: true },
  eventName: { type: String, required: true },
  eventDetails: {
    date: { type: String, required: true },
    time: { type: String, required: true },
  },
  responses: {
    attending: {
      type: [String],
      required: true,
      default: [],
    },
    notAttending: {
      type: [
        {
          name: { type: String, required: true },
          reason: { type: String, required: true },
        },
      ],
      required: true,
      default: [],
    },
  },
});

module.exports = mongoose.model("Event", eventSchema);
