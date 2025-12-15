import { BetLeg } from "../../types";

/**
 * Recursively flattens nested bet legs (e.g., grouped SGP legs) into
 * a single-level array of leaf legs.
 */
export function collectLeafLegs(leg: BetLeg): BetLeg[] {
  if (leg.isGroupLeg && leg.children) {
    return leg.children.flatMap(collectLeafLegs);
  }
  return [leg];
}
