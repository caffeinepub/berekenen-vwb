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

// Sla ETF-vlag op per ticker (bijhouden welke assets ETFs zijn)
const ETF_FLAGS_KEY = "vwb_etf_flags";

export function getEtfFlags(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(ETF_FLAGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setEtfFlag(ticker: string, isEtf: boolean): void {
  const map = getEtfFlags();
  if (!isEtf) {
    delete map[ticker];
  } else {
    map[ticker] = true;
  }
  localStorage.setItem(ETF_FLAGS_KEY, JSON.stringify(map));
}

export function getEtfFlag(ticker: string): boolean {
  return getEtfFlags()[ticker] ?? false;
}

// Sla "lopende kosten van toepassing" vlaggen op per ticker
const ONGOING_COSTS_KEY = "vwb_ongoing_costs_flags";

export function getOngoingCostsFlags(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(ONGOING_COSTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setOngoingCostsFlag(ticker: string, enabled: boolean): void {
  const map = getOngoingCostsFlags();
  if (!enabled) {
    delete map[ticker];
  } else {
    map[ticker] = true;
  }
  localStorage.setItem(ONGOING_COSTS_KEY, JSON.stringify(map));
}

export function getOngoingCostsFlag(ticker: string): boolean {
  return getOngoingCostsFlags()[ticker] ?? false;
}
