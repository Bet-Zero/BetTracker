# Prediction Markets — Master Documentation

**Last Updated:** 2026-02-01  
**Status:** Implemented (Local-First Storage)

---

## Purpose

The Prediction Markets feature provides a **portfolio ledger** for tracking positions and trades on prediction market platforms like **Kalshi**, **Polymarket**, and others.

This is **NOT** the BetTracker "bets" model. It uses a **Positions/Trades** model designed for:
- Low-volume manual entry
- Position-level tracking with multiple trades
- Weighted Average Cost (WAC) accounting for P/L calculation
- Optional manual "Last Known Price" for estimated values (no live API integration)

---

## Non-Goals (Current Phase)

- ❌ Live API integrations (Kalshi/Polymarket auth, real-time prices)
- ❌ Import parsing from platform exports
- ❌ Complex tax lots / FIFO accounting
- ❌ Charts or analytics

---

## Data Model

### PredictionMarket
Represents a market/event on a prediction platform.

```typescript
interface PredictionMarket {
  id: string;
  platform: "Kalshi" | "Polymarket" | string;
  title: string;
  categoryTags?: string[];
  status: "open" | "resolved" | "closed";
  resolvedPrice?: 0 | 1;  // Only when resolved
  notes?: string;
  createdAtIso: string;
  updatedAtIso: string;
}
```

### PredictionPosition
Represents one outcome (e.g., YES/NO) within a market.

```typescript
interface PredictionPosition {
  id: string;
  marketId: string;
  outcome: string;  // "YES", "NO", or custom
  lastKnownPrice?: number;  // Manual entry for est. value
  notes?: string;
  createdAtIso: string;
  updatedAtIso: string;
}
```

### PredictionTrade
Represents a single trade/fill under a position.

```typescript
interface PredictionTrade {
  id: string;
  positionId: string;
  dateIso: string;
  side: "BUY" | "SELL";
  shares: number;
  price: number;  // Cost per share (0-1 range typically)
  fee?: number;
  notes?: string;
}
```

### PredictionPositionMetrics (Computed)
Derived values calculated on-the-fly from trades. **Never stored.**

```typescript
interface PredictionPositionMetrics {
  sharesHeld: number;
  avgEntryPrice: number;
  costBasisHeld: number;
  totalBuyCost: number;
  totalSellProceeds: number;
  totalFees: number;
  realizedPnl: number;
  estValue?: number;           // If lastKnownPrice set
  estUnrealizedPnl?: number;   // If lastKnownPrice set
  finalValue?: number;         // If market resolved
  finalPnl?: number;           // If market resolved
}
```

---

## Accounting Rules — Weighted Average Cost (WAC)

### Algorithm

1. Process trades sorted by `dateIso` ascending
2. Maintain `runningShares` and `runningAvgCost`
3. **BUY:** 
   - `newTotalCost = runningShares * runningAvgCost + tradeShares * tradePrice`
   - `runningShares += tradeShares`
   - `runningAvgCost = newTotalCost / runningShares`
   - `realizedPnl -= fee` (fees increase cost)
4. **SELL:**
   - `realizedPnl += (sellPrice - runningAvgCost) * sharesSold - fee`
   - `runningShares -= sharesSold`
   - Average cost remains unchanged (unless shares = 0)

### Example Walkthrough

| Trade | Side | Shares | Price | Fee | Running Shares | Avg Cost | Realized P/L |
|-------|------|--------|-------|-----|----------------|----------|--------------|
| 1     | BUY  | 100    | 0.50  | 0   | 100            | 0.50     | $0.00        |
| 2     | BUY  | 50     | 0.60  | 0   | 150            | 0.533    | $0.00        |
| 3     | SELL | 75     | 0.70  | 1   | 75             | 0.533    | $11.53       |

Calculation for Trade 3:
- Realized = (0.70 - 0.533) × 75 - 1 = $12.53 - $1 = $11.53

---

## Storage Keys

| Key | Description |
|-----|-------------|
| `bettracker-pm-markets` | Array of PredictionMarket objects |
| `bettracker-pm-positions` | Array of PredictionPosition objects |
| `bettracker-pm-trades` | Array of PredictionTrade objects |

All data stored as JSON strings in localStorage.

---

## UI Layout

### Navigation
- New nav item: **"Prediction Markets"** with TrendingUp icon
- Tab identifier: `predictionMarkets`

### Page Structure

**Tab 1: Positions (Default)**
- Table showing one row per position
- Columns: Platform, Market Title, Outcome, Status, Shares, Avg Entry, Cost Basis, Last Price, Est. Value, Realized P/L, Final P/L
- Click row → Opens Position Details drawer

**Tab 2: Trade Log**
- Flat table of all trades across positions
- Columns: Date, Platform, Market, Outcome, Side, Shares, Price, Fee, Total

### Modals
- **Add Market:** Platform, Title, Notes
- **Add Position:** Market (dropdown), Outcome (YES/NO/Custom), Last Price, Notes
- **Add Trade:** Date, Side (BUY/SELL), Shares, Price, Fee, Notes

### Position Details Drawer
- Market info with editable status (Open/Resolved YES/Resolved NO/Closed)
- Position info with editable Last Known Price
- Metrics grid
- Trades list with delete capability

---

## Future Hooks (Placeholders)

These features are **NOT implemented** but the architecture supports them:

1. **Live Price Integration**
   - Add `lastKnownPriceUpdatedAtIso` field to position
   - Create background polling service
   - Display "price as of" timestamps

2. **Firestore Migration**
   - Storage service is abstracted via CRUD functions
   - Replace localStorage calls with Firestore SDK
   - Add user authentication layer

3. **Import Parsing**
   - Parse Kalshi/Polymarket CSV exports
   - Map to Trade objects
   - Handle duplicate detection

---

## Files

| File | Purpose |
|------|---------|
| `types.ts` | Type definitions (PredictionMarket, PredictionPosition, PredictionTrade, etc.) |
| `services/predictionMarketsStore.ts` | LocalStorage CRUD + WAC calculation |
| `hooks/usePredictionMarkets.tsx` | React context + hook for state management |
| `views/PredictionMarketsView.tsx` | Main page component with tables and modals |
| `App.tsx` | Navigation integration |
