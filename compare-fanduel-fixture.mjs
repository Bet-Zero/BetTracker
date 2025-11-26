#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const fixturePath = path.join(
  process.cwd(),
  "parsing",
  "fixtures",
  "fanduel",
  "expected_fanduel_comprehensive.json"
);

const actualPath =
  process.argv[2] ?? path.join(process.cwd(), "your-html-file_parsed.json");
const outputPath =
  process.argv[3] ??
  path.join(
    process.cwd(),
    "tmp",
    `compare-fanduel-${Date.now()}.json`
  );

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const expectedBets = readJson(fixturePath);
const actualBets = readJson(actualPath);

const toMap = (bets) => new Map(bets.map((b) => [b.betId, b]));

const expectedMap = toMap(expectedBets);
const actualMap = toMap(actualBets);

const allBetIds = Array.from(
  new Set([...expectedMap.keys(), ...actualMap.keys()])
).sort();

const diffs = [];
const missing = [];
const extra = [];
const diffsByBet = new Map(); // betId -> array of field diffs

const deepDiff = (pathKey, exp, act, out, betId) => {
  const isObj = (v) => v && typeof v === "object";

  if (Array.isArray(exp) || Array.isArray(act)) {
    if (!Array.isArray(exp) || !Array.isArray(act)) {
      const diffEntry = { betId, path: pathKey, expected: exp, actual: act };
      out.push(diffEntry);
      if (!diffsByBet.has(betId)) diffsByBet.set(betId, []);
      diffsByBet.get(betId).push(diffEntry);
      return;
    }
    if (exp.length !== act.length) {
      out.push({
        betId,
        path: `${pathKey}.length`,
        expected: exp.length,
        actual: act.length,
      });
    }
    const len = Math.min(exp.length, act.length);
    for (let i = 0; i < len; i++) {
      deepDiff(`${pathKey}[${i}]`, exp[i], act[i], out, betId);
    }
    return;
  }

  if (isObj(exp) || isObj(act)) {
    if (!isObj(exp) || !isObj(act)) {
      const diffEntry = { betId, path: pathKey, expected: exp, actual: act };
      out.push(diffEntry);
      if (!diffsByBet.has(betId)) diffsByBet.set(betId, []);
      diffsByBet.get(betId).push(diffEntry);
      return;
    }
    const keys = new Set([...Object.keys(exp), ...Object.keys(act)]);
    for (const key of keys) {
      deepDiff(`${pathKey}.${key}`, exp[key], act[key], out, betId);
    }
    return;
  }

  if (exp !== act) {
    const diffEntry = { betId, path: pathKey, expected: exp, actual: act };
    out.push(diffEntry);
    if (!diffsByBet.has(betId)) diffsByBet.set(betId, []);
    diffsByBet.get(betId).push(diffEntry);
  }
};

for (const betId of allBetIds) {
  const exp = expectedMap.get(betId);
  const act = actualMap.get(betId);

  if (!exp) {
    extra.push(betId);
    continue;
  }
  if (!act) {
    missing.push(betId);
    continue;
  }

  deepDiff("bet", exp, act, diffs, betId);
}

const printList = (label, items) => {
  if (!items.length) return;
  console.log(`- ${label}: ${items.length}`);
  items.forEach((id) => console.log(`   • ${id}`));
};

if (!missing.length && !extra.length && !diffs.length) {
  console.log("✅ Parsed output matches the FanDuel comprehensive fixture exactly.");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify({ status: "match", fixturePath, actualPath }, null, 2)
  );
  console.log(`Report written to ${outputPath}`);
  process.exit(0);
}

console.log("❌ Differences found between parsed output and fixture:");
printList("Missing bets", missing);
printList("Extra bets", extra);

if (diffs.length) {
  console.log(`- Field mismatches: ${diffs.length}`);
  diffs.slice(0, 25).forEach((d) => {
    console.log(
      `   • ${d.betId} ${d.path}: expected=${JSON.stringify(
        d.expected
      )}, actual=${JSON.stringify(d.actual)}`
    );
  });
  if (diffs.length > 25) {
    console.log(`   ...and ${diffs.length - 25} more differences`);
  }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
// Order mismatchBets to match fixture order for readability
const fixtureOrder = expectedBets.map((b) => b.betId);
const mismatchBetIds = Array.from(diffsByBet.keys()).sort(
  (a, b) => fixtureOrder.indexOf(a) - fixtureOrder.indexOf(b)
);
fs.writeFileSync(
  outputPath,
  JSON.stringify(
    {
      status: "diff",
      fixturePath,
      actualPath,
      missing,
      extra,
      mismatchBets: mismatchBetIds.map((betId) => ({
        betId,
        expected: expectedMap.get(betId) ?? null,
        actual: actualMap.get(betId) ?? null,
        fieldDiffs: diffsByBet.get(betId) ?? [],
      })),
      mismatches: diffs,
    },
    null,
    2
  )
);
console.log(`\n📄 Full report saved to ${outputPath}`);

process.exit(1);
