// Edit these lists to match your own trading model.
export const SETUPS = ["Order block", "Breaker", "FVG / void fill", "Turtle soup (stop run)", "OTE retracement", "Rejection block", "Mitigation block", "Propulsion block", "Vacuum block fill", "Other"];
export const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "Daily", "Weekly"];
export const SESSIONS = ["Asia", "London open", "New York open", "London close", "Daily (position)"];
export const EMOTIONS = ["Calm", "Confident", "Focused", "Patient", "Fearful", "Anxious", "Greedy", "FOMO", "Impatient", "Revengeful", "Bored", "Tired", "Overconfident", "Frustrated"];
export const MISTAKES = ["No setup / impulse", "Chased price", "Moved stop", "Oversized", "Outside killzone", "Against HTF bias", "Traded the news candle", "Exited too early", "Held a loser too long", "Revenge trade", "Ignored checklist", "None"];
export const RULE_CATEGORIES = ["Setup", "Risk", "Time", "Routine", "Mindset", "Go-live"];

export const CHECKLIST = [
  "Big picture: 2 of 4 agree (macro, interest rates, intermarket, seasonal)",
  "Intermediate: 2 of 3 agree (monthly/weekly/daily levels, COT, sentiment)",
  "Correlation: DXY SMT or correlated-pair SMT supports the idea",
  "Time & price: quarterly/weekly range + right time of day (London/NY)",
  "IPDA: clear draw on liquidity (20/40/60-day high or low, equal highs/lows)",
  "Price is in discount (longs) or premium (shorts) of the current range",
  "Entry at a PD array in OTE: OB, FVG, breaker, mitigation or rejection block",
  "Liquidity just raided (Judas swing / turtle soup) and displacement followed",
  "Room to target ≥ 40 pips (intraday) or ≥ 3:1 (higher timeframe)",
  "Risk ≤ 1% of allocation; halved if the last trade lost",
];

export const DEFAULT_RULES: { text: string; category: string }[] = [
  { text: "I only trade setups with a checklist score of 8/10 or more", category: "Setup" },
  { text: "I risk at most 1% of my 30% allocation per trade", category: "Risk" },
  { text: "After a loss I halve my risk on the next trade", category: "Risk" },
  { text: "I stop for the day at −2R", category: "Risk" },
  { text: "I only enter during the London or New York killzone", category: "Time" },
  { text: "I don't trade the candle of a high-impact news release", category: "Time" },
  { text: "I do my morning check-in before opening a chart", category: "Routine" },
  { text: "I log every trade the same day, with screenshots", category: "Routine" },
  { text: "I stay on demo until 30+ trades show positive expectancy", category: "Go-live" },
];

/** ICT seasonal tendencies (Month 5 lessons). Months are 1-12. */
export const SEASONALS: { market: string; months: number[]; dir: "up" | "down"; note: string }[] = [
  { market: "Dollar Index", months: [1, 2], dir: "up", note: "Rallies Jan–Feb" },
  { market: "Dollar Index", months: [6, 7], dir: "up", note: "Major seasonal HIGH June–July, then declines" },
  { market: "Dollar Index", months: [8, 9, 10], dir: "down", note: "Declines into late Oct / early Nov" },
  { market: "10-year T-note", months: [6, 7, 8, 9, 10, 11, 12], dir: "up", note: "Low late May–early July → rally into December" },
  { market: "AUD/USD", months: [3, 4, 5], dir: "up", note: "Rallies March → top in May" },
  { market: "NZD/USD", months: [3, 4], dir: "up", note: "Quarterly low Mar–Apr" },
  { market: "NZD/USD", months: [6, 7], dir: "up", note: "Low June–July" },
  { market: "NZD/USD", months: [9, 10], dir: "up", note: "Low Sept–Oct, strong buy tendency" },
  { market: "NZD/USD", months: [5], dir: "down", note: "Sell-off May → June/July" },
  { market: "GBP/USD", months: [3, 4, 5], dir: "up", note: "Low in March → high in May" },
  { market: "EUR/USD", months: [6, 7], dir: "up", note: "Seasonal LOW June–July" },
  { market: "USD/CHF", months: [6, 7], dir: "down", note: "DXY high / CHF low June–July turn" },
  { market: "USD/JPY", months: [3, 4], dir: "down", note: "Yen low Mar–Apr; sell USD/JPY if dollar bearish" },
  { market: "USD/CAD", months: [9, 10, 11, 12], dir: "up", note: "CAD weak Sept → Christmas (if pair bullish)" },
  { market: "USD/CAD", months: [3, 4, 5], dir: "down", note: "CAD strong mid-Mar → May/June" },
  { market: "Crude oil", months: [3, 4, 5, 6], dir: "up", note: "Rallies ~March → June" },
];

/** Claude model used by the AI tutor. */
export const TUTOR_MODEL = "claude-opus-5-5";
