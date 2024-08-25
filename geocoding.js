const axios = require("axios");
require("dotenv").config();

const getCoordinates = async (city, place) => {
  try {
    // Function to extract data from response
    const extractData = async (data) => {
      const result = data.candidates[0];
      const { lat, lng } = result.geometry.location;
      const formatted_address = result.formatted_address;
      let imageUrl = "";
      if (result.photos != null && result.photos.length > 0) {
        imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${result.photos[0].photo_reference}&key=${process.env.GOOGLE_API_KEY}`;
      }

      return { lat, lng, formatted_address, imageUrl };
    };

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
      {
        params: {
          fields: "formatted_address,name,rating,geometry,photos",
          input: `${city}, ${place}`,
          inputtype: "textquery",
          key: process.env.GOOGLE_API_KEY,
        },
      }
    );

    let data = response.data;

    if (data.status === "OK" && data.candidates.length > 0) {
      return extractData(data);
    } else {
      console.warn(`No results found for place: ${place}`);
      return {};
    }
  } catch (error) {
    console.error(`Error fetching coordinates for place: ${place}`, error);
    return {}; // Return an empty object in case of error
  }
};

module.exports = getCoordinates;
