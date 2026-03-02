# PortfolioFlow

## Current State
- Leningen-pagina heeft herhaalde transacties (recurring) via localStorage
- Herhalingen worden aangemaakt en opgeslagen in `portfolioflow_recurring_loans`
- Er is geen overzicht om actieve herhalingen te bekijken of te verwijderen

## Requested Changes (Diff)

### Add
- Nieuwe component `RecurringSchedulesOverview` op de Leningen-pagina
- Toont alle actieve herhalingen als een lijst/kaart onder de lening-kaarten
- Per herhaling zichtbaar: leningnaam, type (rente/aflossing), bedrag, frequentie, startdatum, einddatum, laatste uitvoering
- Knop om een herhaling te verwijderen (met bevestigingsdialoog)

### Modify
- `LoansPage.tsx` — sectie toevoegen "Actieve herhalingen" onder de leningen
- `AddLoanTransactionDialog.tsx` — geen wijzigingen nodig

### Remove
- Geen

## Implementation Plan
1. Maak `RecurringSchedulesOverview.tsx` in `src/frontend/src/components/loans/`
2. Toont een kaart per actieve herhaling met alle relevante info
3. Verwijderknop met AlertDialog bevestiging
4. Importeer en toon in `LoansPage.tsx` onder de lening-kaarten, alleen als er actieve herhalingen zijn
5. Gebruik bestaande utilities: `formatDate`, `formatEuro`, `LoanTransactionType`
