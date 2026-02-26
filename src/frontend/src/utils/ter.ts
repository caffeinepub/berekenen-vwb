// Sla TER-percentages op per ticker in localStorage
const TER_KEY = "vwb_ter_percentages";

export function getTerPercentages(): Record<string, number> {
  try {
    const raw = localStorage.getItem(TER_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setTerPercentage(ticker: string, pct: number | null): void {
  const map = getTerPercentages();
  if (pct === null || pct === undefined) {
    delete map[ticker];
  } else {
    map[ticker] = pct;
  }
  localStorage.setItem(TER_KEY, JSON.stringify(map));
}

export function getTerPercentage(ticker: string): number | null {
  return getTerPercentages()[ticker] ?? null;
}
