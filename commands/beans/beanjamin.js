const { SlashCommandBuilder } = require("discord.js");
const axios = require("axios");

const serpToken = process.env.SERP_API_KEY;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("beans")
    .setDescription("Find Ben some beans!"),
  async execute(interaction) {
    return interaction.reply("@Zmokkyy do your job 🫘");
    // Fetch a random image from SerpAPI
    // async function getRandomImage(query) {
    // 	const serpApiUrl = `https://serpapi.com/search.json?engine=google_images&q=${query}&api_key=${serpToken}`;
    // 	try {
    // 		const response = await axios.get(serpApiUrl);
    // 		const images = response.data.images_results;

    // 		if (images && images.length > 0) {
    // 			// Pick a random image from the results
    // 			const randomImage = images[Math.floor(Math.random() * images.length)].original;
    // 			return randomImage;
    // 		} else {
    // 			return null;
    // 		}
    // 	} catch (error) {
    // 		console.error('Error fetching image from SerpAPI:', error);
    // 		return null;
    // 	}
    // }

    // // Fetch a random image of 'baked beans'
    // const imageUrl = await getRandomImage('baked beans');

    // // Reply with the image or an error message
    // if (imageUrl) {
    // 	await interaction.reply(imageUrl); // Sends the random image URL
    // } else {
    // 	await interaction.reply('Could not find any beans!');
    // }
  },
};

// CACHE IMAGES TO REDUCE API CALLS
