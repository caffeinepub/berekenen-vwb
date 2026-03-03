# PortfolioFlow

## Current State

- ETF-assets worden aangemaakt in de backend als `AssetType.stock`; de ETF-vlag, TER-percentage en "lopende kosten van toepassing"-vlag worden uitsluitend in `localStorage` opgeslagen via `utils/ter.ts`.
- `useTer.ts` leest deze waarden bij opstarten uit `localStorage` via `useState` en schrijft terug via `setTerPercentage` / `setOngoingCostsFlag`.
- `useSettings.ts` slaat de Twelve Data API-sleutel ook op in `localStorage`.
- Na een sessie-reset, browserwisseling of caches-wipe verdwijnen alle `localStorage`-waarden → TER-percentage en lopende kosten-indicatie "verdwijnen".
- De backend (`main.mo`) heeft wel velden `terEntries` en `ongoingCostsEntries` in `UserData` en in `UserSettingsView`, plus `saveUserSettings` / `getUserSettings` endpoints, maar deze worden vanuit de frontend **nooit aangesproken** — er wordt alleen naar `localStorage` geschreven.
- Kostencarryforward (doorschuiven van kosten naar volgend jaar als onvoldoende gerealiseerde winst) bestaat nog niet.

## Requested Changes (Diff)

### Add

1. **Utility `utils/carryforward.ts`**: berekening van kostencarryforward over meerdere jaren.
   - Input: alle assets, TER-map, ongoingCostsMap, alle jaren met data.
   - Output per jaar: bruto gerealiseerde winst, transactiekosten, ETF lopende kosten (werkelijke lopende kosten-transacties), carryforward vanuit vorige jaren, netto gerealiseerde winst, resterende kosten doorgeschoven naar volgend jaar.
   - Historische carryforward-tabel: per jaar — kosten, verrekend, cumulatief doorgeschoven.

2. **Dashboard — kostenverrekening sectie** (nieuw blok in `PortfolioDashboard.tsx`):
   - Per categorie (Aandelen, Crypto, Grondstoffen) + portefeuilletotaal.
   - Toon: gerealiseerde winst (bruto), transactiekosten, lopende kosten ETF, doorgeschoven kosten, netto gerealiseerde winst, "Nog niet benutte kosten" (oranje indien > 0).

3. **Jaaroverzicht — kostenverrekening sectie** (nieuw blok in `YearOverview.tsx`):
   - Sectie "Gerealiseerde winst en kosten {jaar}" met volledig uitgesplitste weergave.
   - Toon: bruto gerealiseerde winst, kosten {jaar} (transactiekosten + lopende kosten ETF + subtotaal), doorgeschoven kosten per jaar van herkomst + subtotaal, totaal kosten verrekend, netto gerealiseerde winst, resterende kosten doorgeschoven.

4. **Historisch overzicht carryforward-tabel** onderaan jaaroverzicht:
   - Tabel: Jaar | Kosten | Verrekend | Doorgeschoven (cumulatief).

### Modify

5. **TER/ongoingCosts persistentie naar backend** — fix de kern-oorzaak van het verdwijnen van TER-data:
   - `hooks/useUserSettings.ts` (nieuw of uitgebreid): na inloggen `getUserSettings()` aanroepen en TER/ongoingCosts inladen vanuit backend; bij wijziging `saveUserSettings()` aanroepen naast `localStorage`-schrijf.
   - `hooks/useTer.ts`: aanpassen zodat het bij mount de backend-waarden laadt als fallback wanneer `localStorage` leeg is.
   - `AddAssetDialog.tsx` en `EditAssetDialog.tsx`: na opslaan van TER/ongoingCosts ook de backend bijwerken via `saveUserSettings`.
   - De `twelveDataApiKey` wordt meegestuurd bij elke `saveUserSettings`-aanroep zodat bestaande data niet verloren gaat.

6. **`YearStats` interface uitbreiden** met `carryforwardIn`, `carryforwardOut` velden voor gebruik in export/PDF.

### Remove

- Geen bestaande functionaliteit verwijderen.

## Implementation Plan

1. **`utils/carryforward.ts`** aanmaken:
   - Functie `computeCarryforwardHistory(assets, terMap, ongoingCostsMap, years)` die per jaar berekent: bruto gerealiseerde winst (uit `computeRealizedForYear`), transactiekosten, werkelijke lopende kosten (ongoingCosts-transacties), carryforward in, netto resultaat, carryforward out.
   - Exporteer ook `computeCarryforwardForYear(assets, terMap, ongoingCostsMap, year)` als single-year entry.

2. **`hooks/useUserSettings.ts`** aanmaken/uitbreiden:
   - Na initialisatie de backend `getUserSettings()` aanroepen.
   - Sla de backend-waarden op in `localStorage` als er lokaal niets staat (merge-strategie).
   - Exporteer `syncSettingsToBackend(terMap, ongoingCostsMap, apiKey)` helper die `saveUserSettings` aanroept.

3. **`hooks/useTer.ts`** aanpassen:
   - Bij `updateTer` en `updateOngoingCosts`: na `localStorage`-schrijf ook `syncSettingsToBackend` aanroepen.

4. **`AddAssetDialog.tsx` / `EditAssetDialog.tsx`** aanpassen:
   - Na het opslaan van TER/ongoingCosts de backend `saveUserSettings` aanroepen met volledige gecombineerde map.

5. **`PortfolioDashboard.tsx`** uitbreiden:
   - Nieuwe sectie "Kostenverrekening" toevoegen met per-categorie blokken (Aandelen, Crypto, Grondstoffen) en totaalblok.
   - Gebruik `computeCarryforwardForYear` voor het huidige jaar.
   - "Nog niet benutte kosten" oranje tonen indien > 0.

6. **`YearOverview.tsx`** uitbreiden:
   - Nieuwe sectie onder de bestaande StatCards en voor de transactietabel.
   - Sectie "Gerealiseerde winst en kosten {jaar}" met volledige uitsplitsing.
   - Historische carryforward-tabel onderaan.

7. Typecheck en build validatie.
