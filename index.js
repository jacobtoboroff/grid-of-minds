require("dotenv").config();
const fs = require("fs");
const { OpenAI } = require("openai");
const { jsonrepair } = require("jsonrepair");
const { Parser } = require("json2csv");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const prompt = `
Generate a list of 100 countries with the following fields in JSON format (no explanation, no comments):

- country
- capital
- continent
- region
- population
- Area (km²)
- landlocked (yes or no)
- official language
- currency
- borders china (y/n)
- borders russia (y/n)
- religion

Output a JSON array of 100 objects, for example:

[
  {
    "country": "China",
    "capital": "Beijing",
    "continent": "Asia",
    "region": "Eastern Asia",
    "population": 1402112000,
    "Area (km²)": 9596961,
    "landlocked": "no",
    "official language": "Mandarin",
    "currency": "Renminbi",
    "borders china": "n",
    "borders russia": "y",
    "religion": "Buddhism, Taoism"
  },
  ...
]
`;

async function generateCSV() {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;

    // Find JSON array start and end
    const start = content.indexOf("[");
    const end = content.lastIndexOf("]");
    if (start === -1 || end === -1) {
      throw new Error("No valid JSON array found in response.");
    }

    const rawJson = content.substring(start, end + 1);

    // Repair JSON in case of syntax issues
    const repairedJson = jsonrepair(rawJson);

    // Parse JSON array
    const data = JSON.parse(repairedJson);

    // Convert JSON to CSV
    const fields = [
      "country",
      "capital",
      "continent",
      "region",
      "population",
      "Area (km²)",
      "landlocked",
      "official language",
      "currency",
      "borders china",
      "borders russia",
      "religion",
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);

    // Save CSV to file
    fs.writeFileSync("countries.csv", csv);

    console.log("✅ CSV file 'countries.csv' generated successfully.");
  } catch (error) {
    console.error("❌ Error generating CSV:", error);
  }
}

generateCSV();