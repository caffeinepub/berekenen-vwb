# PortfolioFlow

## Current State
- Jaaroverzicht heeft XLSX en PDF exportknoppen
- XLSX export genereert twee tabbladen: Samenvatting en Transacties
- PDF export gebruikt dynamische CDN-imports (jsPDF + autotable) die niet betrouwbaar laden
- Historisch overzicht doorgeschoven kosten is zichtbaar onderaan de jaaroverzicht-pagina (alleen als er data is)
- carryforwardHistory bevat per jaar: costsThisYear, amountSettled, cumulativeCarryforward

## Requested Changes (Diff)

### Add
- Derde tabblad "Doorgeschoven kosten" toevoegen aan de XLSX export met de historische carryforward-tabel
- PDF export: carryforward-historietabel opnemen als extra sectie in de PDF

### Modify
- PDF export: vervang de falende CDN-import door een werkende methode (gebruik jsPDF als npm package via vite bundeling, of als fallback: genereer een HTML-gebaseerde PDF via window.print())
- XLSX export: carryforwardHistory meegeven als parameter zodat het derde tabblad gevuld kan worden
- YearOverview.tsx: exportXlsx en exportPdf aanroepen uitbreiden met carryforwardHistory als argument

### Remove
- Niets verwijderen

## Implementation Plan
1. Installeer jsPDF + jspdf-autotable als npm dependencies zodat PDF-export betrouwbaar werkt zonder CDN-calls
2. Update exportHelpers.ts:
   - exportXlsx: voeg parameter carryforwardHistory toe en maak derde tabblad "Doorgeschoven kosten" aan
   - exportPdf: migreer van CDN-import naar npm-pakket; voeg sectie "Doorgeschoven kosten" toe aan PDF
3. Update YearOverview.tsx: geef carryforwardHistory mee aan beide exportfuncties
