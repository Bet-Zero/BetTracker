import fs from "fs";
import path from "path";
import { parseDraftKingsHTML } from "./parsers/index";
import { JSDOM } from "jsdom";

// Setup global DOM for the parser
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.Element = dom.window.Element;

const htmlPath = path.join(__dirname, "./fixtures/rendered_bet_stub.html");
console.log(`Reading HTML from: ${htmlPath}`);

if (!fs.existsSync(htmlPath)) {
  console.error("Stub file not found!");
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, "utf-8");
const bets = parseDraftKingsHTML(html);

console.log(JSON.stringify(bets, null, 2));
