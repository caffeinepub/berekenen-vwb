# PortfolioFlow

## Current State
De app ondersteunt transacties van type koop/verkoop/dividend/staking. Een "Lopende kosten"-transactie (ongoingCosts) is frontend-only gedefinieerd als string constante `"ongoingCosts"`. De Motoko backend heeft dit type **niet** in de `TransactionType` union, waardoor het opslaan mislukt met een foutmelding. De frontend berekeningen (werkelijke lopende kosten, carryforward) zijn al correct opgezet maar kunnen nooit data bevatten omdat het opslaan mislukt.

## Requested Changes (Diff)

### Add
- `#ongoingCosts` variant aan Motoko `TransactionType` union
- `ongoingCosts` aan frontend `TransactionType` enum in `backend.d.ts`

### Modify
- Motoko `TransactionType` type uitbreiden met `#ongoingCosts`
- `backend.d.ts` `TransactionType` enum uitbreiden met `ongoingCosts = "ongoingCosts"`
- `transactionTypes.ts`: `TX_ONGOING_COSTS` en `isOngoingCostsType` aanpassen om de echte enum-waarde te gebruiken (geen cast meer nodig)
- `AddTransactionDialog.tsx`: gebruik `TransactionType.ongoingCosts` i.p.v. de cast-workaround
- `YearOverview.tsx`, `yearStats.ts`, `carryforward.ts`: controleren of de isOngoingCostsType checks nog werken met de echte enum

### Remove
- De `as unknown as TransactionType` cast-workaround voor ongoingCosts in transactionTypes.ts en AddTransactionDialog.tsx

## Implementation Plan
1. Motoko `main.mo`: voeg `#ongoingCosts` toe aan `TransactionType` union (publiek en intern)
2. `backend.d.ts`: voeg `ongoingCosts = "ongoingCosts"` toe aan `TransactionType` enum
3. `transactionTypes.ts`: gebruik `TransactionType.ongoingCosts` direct, verwijder cast
4. `AddTransactionDialog.tsx`: gebruik `TransactionType.ongoingCosts` i.p.v. `TX_ONGOING_COSTS` cast
5. Valideer dat `isOngoingCostsType` check in alle utils correct werkt
6. Typecheck en build
