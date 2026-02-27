# Berekenen VWB

## Current State

De app heeft een zijnavigatie met: Aandelen, Crypto, Grondstoffen, Leningen, Jaaroverzicht, Instellingen.
Elke sectie heeft zijn eigen pagina. Er is geen aparte landingspagina / dashboard-overzicht van de volledige portefeuille.
Er bestaat al een `Dashboard.tsx` component, maar dit is een per-sectie samenvatting (5 kaartjes met stats), geen portefeuille-brede landingspagina.
Grafieken zijn nergens aanwezig. De `recharts` library is nog niet geïnstalleerd.

Data beschikbaar:
- `useAllAssets()` → `AssetView[]` met transacties en currentPrice
- `useAllLoans()` → `LoanView[]` met lening-transacties
- `useCommodities()` → `commodityTickers: Set<string>` (welke tickers grondstoffen zijn)
- `useTer()` → `terMap` (TER percentages per ticker)
- FIFO-berekeningen via `calculateFifo(transactions, currentPrice)`
- LoanTransactionType: `interestReceived` en `repaymentReceived`

## Requested Changes (Diff)

### Add

- **Nieuw tabblad "Dashboard"** — bovenaan de navigatielijst (eerste item), als landingspagina
- **Nieuw component `PortfolioDashboard.tsx`** met:
  1. **Totaalkaart** (bovenaan): totaal geïnvesteerd, totale actuele waarde, gerealiseerd rendement, ongerealiseerd rendement, totaal rendement (€ en %). Groen bij positief, rood bij negatief.
  2. **Vier categorie-kaarten** (naast elkaar in een grid): Aandelen, Crypto, Grondstoffen, Leningen. Elk met relevante stats. Klikken navigeert naar het betreffende tabblad.
  3. **Grafiek 1 — Portefeuillewaarde over tijd** (lijndiagram): totale waarde per maand, filter: 3M/6M/1J/Alles. Waarde wordt berekend op basis van cumulatieve inleg minus verkopen + gerealiseerde winst als benadering (zonder historische prijsdata). Let op: Recharts moet worden geïnstalleerd.
  4. **Grafiek 2 — Verdeling portefeuille** (donut diagram): huidige waarde per categorie in %.
  5. **Grafiek 3 — Gerealiseerd rendement per categorie per jaar** (gegroepeerd staafdiagram): per jaar, naast elkaar per categorie.
  6. **Grafiek 4 — Rendement vergelijking** (horizontaal staafdiagram): totaal rendement % per categorie.
  7. **Recente transacties** (onderaan): de 8 meest recente transacties over alle categorieën. Kolommen: datum, categorie, naam, type, bedrag. Klikken navigeert naar het betreffende tabblad.
  8. **Lege staat**: als er geen transacties zijn, toon: "Voeg je eerste transactie toe om je overzicht te zien."
- **Dashboard sectie-ID** toevoegen aan de `Section` type in `App.tsx`

### Modify

- **`App.tsx`**: 
  - `Section` type uitbreiden met `"dashboard"`
  - SECTIONS array: "Dashboard" als eerste item toevoegen (met LayoutDashboard of PieChart icoon)
  - Standaard actieve sectie wijzigen van `"stocks"` naar `"dashboard"`
  - Conditionele rendering uitbreiden met `isDashboard` case die `PortfolioDashboard` toont
  - `PortfolioDashboard` ontvangt `assets`, `loans`, `commodityTickers`, `terMap` props en een `onNavigate` callback

### Remove

Niets verwijderd.

## Implementation Plan

1. Installeer `recharts` package via pnpm in de frontend
2. Maak `src/frontend/src/components/PortfolioDashboard.tsx`:
   - Bereken per categorie: stocks = assets waar assetType=stock EN niet in commodityTickers, crypto = assetType=crypto, commodities = assetType=stock EN in commodityTickers
   - Totaalkaart: som over alle assets van calculateFifo resultaten + loans
   - Categorie-kaarten: 4 kaarten met per-categorie stats, klikbaar
   - Grafiek 1 (lijn): bouw maandpunten op basis van transactiedatums — cumulatief berekend netto vermogen per maand (inleg - kostenbasis verkopen + gerealiseerd + current value). Gebruik een gesimplificeerde benadering: per maand = totale inleg t/m die maand + gerealiseerd t/m die maand + actuele waarde op dat moment (gebruik currentPrice als benadering voor alle maanden). Filter knoppen: 3M, 6M, 1J, Alles.
   - Grafiek 2 (donut): huidige waarde per categorie
   - Grafiek 3 (gegroepeerd staaf): gerealiseerde winst per categorie per jaar
   - Grafiek 4 (horizontale staaf): totaal rendement % per categorie
   - Recente transacties: verzamel alle transacties over alle assets + loan-transacties, sorteer op datum descending, neem top 8
3. Update `App.tsx`: dashboard als eerste tab, standaard actief, renderen van PortfolioDashboard
