# PortfolioFlow

## Current State
Stap 6 van de CSV-importwizard (`CsvImportWizard.tsx`) toont alleen een alleen-lezen preview van de eerste 10 te importeren transacties. De gebruiker kan geen waarden aanpassen en geen rijen verwijderen vóór de definitieve import.

## Requested Changes (Diff)

### Add
- Bewerkbare tabel in stap 6: elke kolom (datum, type, aantal, prijs/stuk, kosten) is inline bewerkbaar via een tekstinput of select-dropdown.
- Verwijderknop per rij, waarmee de gebruiker een rij uit de voorvertoning kan verwijderen vóór import.
- De tabel toont ALLE te importeren rijen (niet meer beperkt tot 10), scrollbaar binnen de dialoog.
- Visuele markering voor duplicaatregels (worden grijs of doorgestreept weergegeven en zijn niet bewerkbaar maar wel verwijderbaar).

### Modify
- `buildImportRows()` resultaat wordt opgeslagen in React state (`editableRows`) bij het betreden van stap 6, zodat bewerkingen en verwijderingen de state muteren.
- `handleImport()` gebruikt de `editableRows` state in plaats van `buildImportRows()` opnieuw aan te roepen.
- De "Importeren"-knop is uitgeschakeld als er geen geldige, niet-verwijderde rijen zijn.
- De samenvattingstegels (te importeren / duplicaten / ongeldig) worden live bijgewerkt op basis van `editableRows`.

### Remove
- De beperking van max. 10 preview-rijen in stap 6.

## Implementation Plan
1. Definieer `EditableImportRow` type dat `ImportRow` uitbreidt met een `id` (index) en `deleted: boolean`.
2. Voeg `editableRows` state toe (leeg array bij initialisatie).
3. In `goToStep6()`: bouw de rows, sla ze op als `editableRows` (alle rows, inclusief duplicaten en invaliden).
4. Schrijf hulpfuncties `updateRow(id, field, value)` en `deleteRow(id)` die `editableRows` muteren.
5. Herbouw `renderStep6()`:
   - Samenvattingstegels live berekend uit `editableRows` (excl. deleted).
   - Scrollbare tabel met alle niet-deleted, geldige rijen als bewerkbare invoervelden.
   - Datum: `<Input type="text">` met huidige waarde als string (DD-MM-YYYY formaat).
   - Type: `<Select>` met de beschikbare transactietypes.
   - Aantal: `<Input type="number">`.
   - Prijs/stuk of eurovalue: `<Input type="number">`.
   - Kosten: `<Input type="number">`.
   - Verwijderknop (X-icoon) aan het einde van elke rij.
   - Duplicaatregels apart getoond onderaan (grijs, niet bewerkbaar, wél verwijderbaar).
6. `handleImport()` itereert over `editableRows.filter(r => !r.deleted && r.isValid && !r.isDuplicate)`.
7. `resetWizard()` reset ook `editableRows`.
