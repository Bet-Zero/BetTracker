import fs from "fs";
import path from "path";
import { parseDraftKings } from "../parsers"; // Assuming the parser is exported from this path

const filePath = path.resolve(__dirname, "../fixtures/sample_draftkings.html");

// Read the sample HTML file
fs.readFile(filePath, "utf8", (err, data) => {
  if (err) {
    console.error("Error reading the file:", err);
    return;
  }

  try {
    // Parse the HTML content
    const result = parseDraftKings(data);

    // Output the result
    console.log("Parsed Output:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error parsing the file:", error);
  }
});
