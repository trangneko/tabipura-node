import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { differenceInDays, parseISO } from "date-fns";
import getCoordinates from "./geocoding.js";

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());
// Middleware
app.use(bodyParser.json());

// Access your API key as an environment variable (see "Set up your API key" above)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
};

const jsonSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
    },
    trip_type: {
      type: "string",
    },
    budget_type: {
      type: "string",
    },
    trip_pace: {
      type: "string",
    },
    interest: {
      type: "string",
    },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          day: {
            type: "integer",
            date: { type: "string", pattern: "^(\\d{4})-(\\d{2})-(\\d{2})$" },
          },
          activities: {
            type: "array",
            properties: {
              place: {
                type: "string",
              },
              coordinates: {
                "type": "object",
                "properties": {
                  "lat": { "type": "number" },
                  "lng": { "type": "number" },
                }
              },
              address: { "type": "string" },
              imageUrl: { "type": "string" },
              description: {
                type: "string",
              }
            },
            required: ["place", "description"],
          },
        },
        required: ["day", "date", "activities"],
      },
    },
    tips: {
      type: "string",
    },
  },
  required: [
    "title",
    "trip_type",
    "budget_type",
    "trip_pace",
    "interest",
    "days",
  ],
};

async function generateTripPlan(
  location,
  dateStart,
  dateEnd,
  tripType,
  budgetType,
  tripPace,
  interest
) {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro",
    generationConfig: generationConfig,
  });

  const startDate = parseISO(dateStart);
  const endDate = parseISO(dateEnd);
  const period = differenceInDays(endDate, startDate) + 1;
  console.log("number of days:", period);

  const prompt = `You are a smart travel planner. Plan a ${period}-day trip in ${location} from ${startDate} to ${endDate} with these conditions:
  - Trip type (I go travel with...): ${tripType}
  - Budget type: ${budgetType}
  - Trip pace: ${tripPace}
  - Interest: ${interest}
  You should design destinations near each other in one day so it's convenient. Remember that all the "place" in schema must be real places, not your words. Answer following JSON schema.<JSONSchema>${JSON.stringify(
    jsonSchema
  )}</JSONSchema>`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  console.log(text);

  try {
    const jsonResponse = JSON.parse(text); // Ensure the response is valid JSON
    // Add coordinates to each activity
    for (const day of jsonResponse.days) {
      for (const activity of day.activities) {
        const coords = await getCoordinates(location, activity.place);
        activity.coordinates = coords ? { lat: coords.lat, lng: coords.lng } : null;
        activity.address = coords ? coords.formatted_address : null;
        activity.imageUrl = coords ? coords.imageUrl : null;
        console.log("coords: ",coords);
      }
    }
    return jsonResponse;
  } catch (error) {
    console.error("Error parsing JSON response:", error);
    throw new Error("Invalid JSON response from AI model");
  }
}

app.post("/generate-trip", async (req, res) => {
  const {
    location,
    dateStart,
    dateEnd,
    tripType,
    budgetType,
    tripPace,
    interest,
  } = req.body;

  try {
    const tripPlan = await generateTripPlan(
      location,
      dateStart,
      dateEnd,
      tripType,
      budgetType,
      tripPace,
      interest
    );
    res.json(tripPlan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
