# PortfolioFlow

## Current State
- Dashboard (tab Aandelen) toont een hoofdtegel "Totale lopende kosten" (berekend op basis van TER % × actuele waarde), maar geen tegel "Werkelijke lopende kosten".
- In `Dashboard.tsx` wordt `totalOngoingCosts` doorgegeven als TER-berekening, niet als som van "Lopende kosten"-transacties.
- De `computeSummary`-functie in `Dashboard.tsx` berekent `totalReturn` als bruto rendement zonder aftrek van transactiekosten of werkelijke lopende kosten.
- In `TransactionHistory.tsx` toont de kolom "Kosten" alleen `tx.fees`. Voor een "Lopende kosten"-transactie (`ongoingCosts`) is `tx.fees` leeg/undefined → streepje.
- In `AddAssetDialog.tsx` wordt bij `handleSelectStock` de `hasOngoingCosts` altijd gereset naar `false` wanneer een zoekresultaat geselecteerd wordt (zelfs als type "etf" is). Dit zorgt ervoor dat de indicatie na selectie verdwijnt.
- `App.tsx` berekent `totalOngoingCosts` als TER-berekening (percentage × waarde), maar de tegel heet "Totale lopende kosten" i.p.v. "Lopende kosten (TER)".

## Requested Changes (Diff)

### Add
- Nieuwe prop `totalActualOngoingCosts` in `Dashboard.tsx` voor de tegel "Werkelijke lopende kosten" (som van "Lopende kosten"-transacties).
- In `App.tsx`: berekening van `totalActualOngoingCosts` als som van alle `ongoingCosts`-transacties bij stockAssets.

### Modify
- `Dashboard.tsx`: Hernoem tegel "Totale lopende kosten" naar "Lopende kosten (TER)". Voeg tegel "Werkelijke lopende kosten" toe (toont `totalActualOngoingCosts`). Pas `computeSummary` aan zodat `totalReturn` = bruto rendement − transactiekosten − werkelijke lopende kosten.
- `App.tsx`: Geef `totalActualOngoingCosts` door aan `<Dashboard>`. Pas `totalOngoingCosts` naam aan voor de TER-berekening.
- `TransactionHistory.tsx`: In de kolom "Kosten" — voor een `ongoingCosts`-transactie, toon `tx.euroValue` als het bedrag (i.p.v. `tx.fees`).
- `AddAssetDialog.tsx`: Bij `handleSelectStock`, reset `hasOngoingCosts` NIET bij ETF-type. Of beter: bewaar `hasOngoingCosts` onveranderd als het type niet wijzigt. Zorg dat wanneer het instrument_type ETF is, de `hasOngoingCosts` niet automatisch op `false` wordt gezet.

### Remove
- Geen bestaande features verwijderen.

## Implementation Plan
1. `Dashboard.tsx`: voeg prop `totalActualOngoingCosts` toe; hernoem "Totale lopende kosten" naar "Lopende kosten (TER)"; voeg tegel "Werkelijke lopende kosten" toe; pas `computeSummary` aan om transactiekosten en werkelijke lopende kosten af te trekken van `totalReturn`.
2. `App.tsx`: voeg `totalActualOngoingCosts`-berekening toe (som ongoingCosts transacties uit stockAssets); geef door aan `<Dashboard>`.
3. `TransactionHistory.tsx`: in de "Kosten" kolom, voor ongoingCosts type gebruik `tx.euroValue ?? tx.fees` als weergavewaarde.
4. `AddAssetDialog.tsx`: bij `handleSelectStock`, zet `hasOngoingCosts` niet terug op `false` — behoud de huidige waarde of zet hem op basis van `detectedType === "etf"` (maar reset hem niet onnodig).
