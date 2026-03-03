# PortfolioFlow

## Current State

In het tabblad Aandelen (AssetsList.tsx) worden de volgende tegels getoond per asset:
- Stuks in bezit, Inleg, Actuele waarde, Ongerealiseerd, Gerealiseerd, Huidige prijs
- "Totale transactiekosten"
- "Totaal rendement" (berekend als bruto rendement − transactiekosten, maar ZONDER werkelijke lopende kosten)
- "Lopende Kosten (TER)" (indicatief, conditioneel zichtbaar)

De tegel "Werkelijke lopende kosten" (totaal van geregistreerde lopende kosten transacties) ontbreekt volledig in het tabblad Aandelen.

Het "Totaal rendement" verrekent de werkelijke lopende kosten NIET (bug).

De volgorde van tegels klopt niet: Transactiekosten en Werkelijke lopende kosten moeten vóór Totaal rendement staan, TER-tegel ná Totaal rendement.

In het Jaaroverzicht (YearOverview.tsx) bestaat de tegel "Werkelijke lopende kosten" al en wordt correct verrekend in het netto rendement.

## Requested Changes (Diff)

### Add
- Nieuwe tegel "Werkelijke lopende kosten" in het tabblad Aandelen (AssetsList.tsx) per asset: toont het totaal van alle transacties van type "Lopende kosten" (ongoingCosts) voor die asset, op basis van euroValue.

### Modify
- AssetsList.tsx: Correcte volgorde tegels wordt:
  1. Stuks in bezit
  2. Inleg
  3. Actuele waarde
  4. Ongerealiseerd
  5. Gerealiseerd
  6. Huidige prijs
  7. Totale transactiekosten
  8. Werkelijke lopende kosten (nieuw, altijd zichtbaar als > 0, anders € 0,00)
  9. Totaal rendement (herberekend: bruto − transactiekosten − werkelijke lopende kosten)
  10. Lopende Kosten (TER) (conditioneel, alleen bij ETF met TER > 0)

- AssetsList.tsx: Rendementsberekening aanpassen:
  - `grossReturn = fifo.realized + fifo.unrealized`
  - `actualOngoingCosts = som van alle transacties met type ongoingCosts (euroValue)`
  - `netReturn = grossReturn - totalTxFees - actualOngoingCosts`
  - `netReturnPct` op basis van netReturn / netInvested

### Remove
- Niets verwijderd.

## Implementation Plan

1. In AssetsList.tsx: berekening toevoegen van `actualOngoingCosts` per asset (sum van alle tx met isOngoingCostsType → euroValue).
2. In AssetsList.tsx: `netReturn` aanpassen naar `grossReturn - totalTxFees - actualOngoingCosts`.
3. In AssetsList.tsx: nieuwe MetricCell "Werkelijke lopende kosten" toevoegen, altijd tonen (rood als > 0, anders neutrale kleur).
4. In AssetsList.tsx: volgorde van MetricCells aanpassen conform de gewenste volgorde.
5. Import van `isOngoingCostsType` toevoegen aan AssetsList.tsx.
