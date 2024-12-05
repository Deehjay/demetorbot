const Event = require("../models/Event");

async function saveEventToDatabase(event) {
  const { eventName, eventDetails, eventCreator } = event;
  try {
    const newEvent = new Event(event);
    await newEvent.save();

    console.log(
      `[Event] Event "${eventName}" on ${eventDetails.date} created by ${eventCreator} has been saved to the database.`
    );
    return newEvent;
  } catch (error) {
    console.error(
      `[Database Error] Failed to save event "${eventName}" on ${eventDetails.date}: ${error}`
    );
  }
}

async function fetchEventFromDatabase(eventId) {
  try {
    const event = await Event.findOne({ eventId: eventId });
    return event;
  } catch (error) {
    console.error(`[Database Error] Failed to fetch event with ID ${eventId}: ${error}`);
  }
}

async function updateEventResponseInDatabase(eventDocId, updateDetails, optionalProperty) {
  try {
    const query = { _id: eventDocId };

    if (optionalProperty !== undefined) {
      const [key, value] = optionalProperty;
      query[key] = value;
    }
    const event = await Event.updateOne(query, updateDetails);
    return event;
  } catch (error) {
    console.error(`[Database Error] Failed to update event with ID ${eventDocId}: ${error}`);
  }
}

module.exports = { saveEventToDatabase, fetchEventFromDatabase, updateEventResponseInDatabase };
