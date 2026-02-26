# Berekenen VWB

## Current State

- Aandelen en Crypto sectie met FIFO-berekeningen per asset
- Jaaroverzicht tabblad met statistieken per jaar (geïnvesteerd, verkopen, kosten, gerealiseerd, ongerealiseerd, TER, netto rendement)
- TER (Total Expense Ratio) instelbaar per asset (aandelen), opgeslagen in localStorage
- Lopende kosten per transactie: checkbox `hasOngoingCosts` bepaalt welke transacties meetellen voor TER
- Actuele waarde wordt getoond zowel op asset-niveau als in de transactietabel op de jaaroverzichtpagina
- Crypto heeft geen TER, maar de lopende kosten checkbox is nog zichtbaar in het transactieformulier ongeacht asset type
- In het jaaroverzicht ontbreekt een kolom "Lopende kosten (transactie)"
- In het jaaroverzicht staat geen subtotaalregel voor lopende kosten per transactie

## Requested Changes (Diff)

### Add
- Lopende kosten (TER) berekend per transactie: voor elke transactie met `hasOngoingCosts === true` wordt het jaarlijkse TER-bedrag berekend op basis van de aankoopwaarde van die transactie (aantal × pricePerUnit × terPercentage). Dit wordt zichtbaar in de transactietabel van de betreffende asset (TransactionHistory).
- In het jaaroverzicht: een aparte kolom/regel "Lopende kosten transactie" die de som is van alle TER-kosten per transactie in het betreffende jaar.
- In het jaaroverzicht een totaalregel onderaan die alle transacties + bijbehorende lopende kosten optelt voor het gekozen jaar.

### Modify
- `AddTransactionDialog` en `EditTransactionDialog`: de checkbox "Lopende kosten van toepassing" wordt alleen getoond voor aandelen (AssetType.stock), niet voor crypto.
- `AssetsList` (TransactionHistory): voeg een kolom "Lopende kosten" toe per transactie die `hasOngoingCosts === true` is, gebaseerd op het TER-percentage van de asset × aankoopwaarde van de transactie.
- `YearOverview`: voeg in de transactietabel een kolom "Lopende kosten" toe per rij (voor transacties met `hasOngoingCosts === true`).
- `YearOverview`: voeg een totaalrij toe onderaan de transactietabel met de som van alle aankopen, kosten en lopende kosten per jaar.
- `YearOverview` stats grid: toon de "Lopende kosten (transacties)" als apart StatCard naast de bestaande TER.
- Actuele waarde verwijderen uit de transactietabel van het jaaroverzicht (het staat al op asset-niveau in de AssetsList).

### Remove
- "Huidige waarde" kolom uit het jaaroverzicht transactietabel (actuele waarde staat al per asset in de AssetsList).

## Implementation Plan

1. Maak een utility functie `computeTransactionTer(tx, ter)` die voor een transactie met `hasOngoingCosts` het jaarlijkse TER-bedrag berekent: `quantity × pricePerUnit × (ter / 100)`.
2. Update `TransactionHistory` component: voeg een kolom "Lopende kosten" toe die per transactie de TER-kosten toont als `hasOngoingCosts` actief is en het asset een TER heeft. Geef `terMap` en `ticker` door als props.
3. Update `AssetsList` om `terMap` door te geven aan `TransactionHistory`.
4. Update `AddTransactionDialog`: verberg de "Lopende kosten" checkbox voor crypto assets (alleen tonen voor `AssetType.stock`).
5. Update `EditTransactionDialog`: zelfde aanpassing als AddTransactionDialog.
6. Update `YearOverview`:
   - Voeg kolom "Lopende kosten" toe in de transactietabel per transactie (gebaseerd op `hasOngoingCosts` + terMap).
   - Verwijder actuele waarde kolom.
   - Voeg een totaalrij toe onder de transactietabel.
   - Voeg een StatCard toe voor "Lopende kosten (transacties)" die de som toont van alle per-transactie TER-kosten in het jaar.
   - Pas `netReturn` berekening aan zodat ook de per-transactie TER-kosten worden afgetrokken.

## UX Notes

- Lopende kosten per transactie = jaarlijkse kosten op basis van de aankoopwaarde; weergegeven als negatief getal (kosten).
- De checkbox in het transactieformulier is niet zichtbaar voor crypto assets.
- Totaalrij in de transactietabel toont: totaal geïnvesteerd, totaal kosten, totaal lopende kosten voor het jaar.
- Actuele waarde is alleen zichtbaar op asset-niveau (AssetsList), niet meer in het jaaroverzicht transactietabel.
