import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const fixturePath = path.join(
  process.cwd(),
  "parsing",
  "fixtures",
  "fanduel",
  "expected_fanduel_comprehensive.json"
);
const actualPath = path.join(process.cwd(), "your-html-file_parsed.json");

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));

const toMap = (bets: any[]) => new Map(bets.map((b) => [b.betId, b]));

function deepDiff(
  pathKey: string,
  exp: any,
  act: any,
  out: any[],
  betId: string
) {
  const isObj = (v: any) => v && typeof v === "object";
  if (Array.isArray(exp) || Array.isArray(act)) {
    if (!Array.isArray(exp) || !Array.isArray(act)) {
      out.push({ betId, path: pathKey, expected: exp, actual: act });
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
      out.push({ betId, path: pathKey, expected: exp, actual: act });
      return;
    }
    const keys = new Set([...Object.keys(exp), ...Object.keys(act)]);
    for (const key of keys) {
      deepDiff(`${pathKey}.${key}`, exp[key], act[key], out, betId);
    }
    return;
  }
  if (exp !== act) {
    out.push({ betId, path: pathKey, expected: exp, actual: act });
  }
}

describe("FanDuel parsed output vs comprehensive fixture", () => {
  it("should match the expected fixture exactly", () => {
    const expectedBets = readJson(fixturePath);
    const actualBets = readJson(actualPath);
    const expectedMap = toMap(expectedBets);
    const actualMap = toMap(actualBets);
    const allBetIds = Array.from(
      new Set([...expectedMap.keys(), ...actualMap.keys()])
    ).sort();
    const diffs: any[] = [];
    const missing: string[] = [];
    const extra: string[] = [];
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
    expect(missing, `Missing bets: ${missing.join(", ")}`).toHaveLength(0);
    expect(extra, `Extra bets: ${extra.join(", ")}`).toHaveLength(0);
    expect(
      diffs,
      `Field mismatches: ${JSON.stringify(diffs, null, 2)}`
    ).toHaveLength(0);
  });
});
