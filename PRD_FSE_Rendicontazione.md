# PRD — FSE+ Rendicontazione Manager
**Versione:** 1.0  
**Data:** Marzo 2026  
**Stato:** Draft  

---

## 1. Panoramica del Prodotto

### 1.1 Problema

La rendicontazione di progetti FSE+ (Fondo Sociale Europeo Plus) — in particolare per il PR FSE+ Toscana 2021-2027 — è un processo manuale, frammentato e ad alto rischio di errore. Chi si occupa di rendicontazione deve:

- Estrarre manualmente le ore dalle buste paga PDF
- Costruire a mano la struttura documentale richiesta dal manuale beneficiari
- Compilare timecard per ogni persona coinvolta
- Tenere traccia di quali documenti mancano prima della scadenza

Il risultato è lavoro ripetitivo, errori, fascicoli incompleti e stress alla vigilia delle scadenze.

### 1.2 Soluzione

**FSE+ Rendicontazione Manager** è una web app che automatizza la parte meccanica della rendicontazione FSE+:

1. L'utente crea un progetto, seleziona la modalità di rendicontazione e carica le buste paga PDF
2. Il sistema estrae automaticamente le ore per persona
3. Genera la struttura delle cartelle conforme al manuale beneficiari
4. Produce le timecard PDF già precompilate con ore e dati del progetto
5. Mostra una checklist dei documenti mancanti
6. Permette di scaricare tutto come archivio zip

### 1.3 Utente Target

Una sola utente (per ora): la rendicontatrice dell'organizzazione. Profilo tecnico medio-basso, alta competenza sul dominio FSE+. Lavora su più progetti contemporaneamente, spesso sotto pressione di scadenze trimestrali.

---

## 2. Obiettivi e Non-obiettivi

### Obiettivi (v1.0)
- Gestione multi-progetto con modalità di rendicontazione configurabile per progetto
- Upload e parsing automatico di buste paga PDF
- Estrazione nome persona e ore lavorate dalla busta paga
- Generazione struttura cartelle FSE+ conforme al manuale (Sezione B)
- Generazione timecard PDF brandizzate e precompilate
- Checklist documenti mancanti per progetto
- Export zip dell'intera struttura documentale
- Visualizzazione e modifica leggera della struttura nella webapp

### Non-obiettivi (fuori scope v1.0)
- Multi-utente / autenticazione avanzata
- Integrazione con il Sistema Informativo FSE regionale (SI FSE)
- Compilazione automatica della scheda finanziaria PED
- Calcolo automatico dei massimali di costo orario
- Firma digitale delle timecard
- Notifiche email sulle scadenze
- Supporto a progetti UCS (Sezione C del manuale) — solo Sezione B

---

## 3. Architettura di Alto Livello

### 3.1 Stack Tecnologico Consigliato

**Frontend**
- React + TypeScript
- Tailwind CSS
- React Router (navigazione multi-pagina)
- React Query (stato server)
- PDF.js (preview PDF nel browser)

**Backend**
- Node.js + Express (o FastAPI Python se si preferisce per il parsing PDF)
- PostgreSQL (dati strutturati progetti, persone, ore)
- Multer (upload file)
- pdfplumber / PyPDF2 (estrazione testo da buste paga PDF) — meglio Python per questo
- Puppeteer o WeasyPrint (generazione timecard PDF)
- Archiver / JSZip (generazione zip)

**Deployment**
- Applicazione single-tenant (un solo utente)
- Può girare in locale o su VPS semplice
- Nessun requisito di scalabilità particolare in v1.0

### 3.2 Modello Dati Core

```
Progetto
├── id
├── nome
├── codice_progetto
├── denominazione_attivita
├── ente_agenzia
├── modalita_rendicontazione  [staff_40 | forfettario_7 | costi_reali]
├── data_inizio
├── data_fine
├── loghi[]  (file path)
├── created_at

Persona
├── id
├── progetto_id
├── nome
├── cognome
├── ruolo  (docente_interno | coordinatore | tutor | amministrativo | ecc.)
├── numero_incarico
├── costo_orario
├── created_at

BustaPaga
├── id
├── persona_id
├── progetto_id
├── mese  (YYYY-MM)
├── file_path  (PDF originale)
├── ore_estratte  (numero decimale)
├── nome_estratto  (da OCR/parsing)
├── cognome_estratto
├── stato_parsing  [pending | ok | errore | revisione_manuale]
├── created_at

Timecard
├── id
├── persona_id
├── progetto_id
├── mese
├── righe[]  (JSON array)
│   ├── data
│   ├── ore
│   ├── orario_inizio
│   ├── orario_fine
│   ├── descrizione_attivita
│   ├── sede
│   └── numero_incarico
├── stato  [bozza | generata | firmata]
├── file_pdf_path
├── created_at

DocumentoRichiesto
├── id
├── progetto_id
├── persona_id  (nullable — alcuni documenti sono di progetto)
├── categoria  (busta_paga | timecard | ordine_servizio | f24 | ecc.)
├── descrizione
├── mese  (nullable)
├── stato  [mancante | caricato | verificato]
├── file_path
```

---

## 4. Funzionalità Dettagliate

---

### 4.1 Dashboard — Lista Progetti

**Schermata principale** dopo il login (o apertura dell'app).

**Contenuto:**
- Lista di tutti i progetti attivi con:
  - Nome progetto + codice
  - Modalità rendicontazione (badge colorato)
  - Percentuale completezza documentazione (progress bar)
  - Numero documenti mancanti (alert rosso se > 0)
  - Data ultimo aggiornamento
- Pulsante "Nuovo Progetto" prominente
- Filtri rapidi: tutti / attivi / archiviati

**Azioni:**
- Click su progetto → apre il progetto
- Archivia progetto
- Duplica progetto (utile per progetti simili)

---

### 4.2 Creazione Nuovo Progetto

**Wizard in 3 step:**

**Step 1 — Dati Progetto**
- Nome progetto (testo libero)
- Codice progetto (es. `FSE+2024-TOS-001`)
- Ente / Agenzia capofila
- Denominazione attività
- Data inizio e fine progetto
- Modalità di rendicontazione:
  - `Staff + 40%` — solo costi diretti di personale + forfait
  - `Forfettizzazione 7%` — tutti i costi diretti + 7% indiretti
  - `Costi reali` — tutti i costi diretti e indiretti documentati
  - Tooltip esplicativo per ciascuna opzione (testo tratto dal manuale)

**Step 2 — Loghi**
- Upload loghi delle realtà partecipanti (PNG/SVG, max 5)
- Preview immediata
- Ordinamento drag-and-drop (ordine usato nelle timecard)

**Step 3 — Persone**
- Tabella editabile per aggiungere le persone coinvolte:
  - Nome + Cognome
  - Ruolo (dropdown con voci del PED FSE+)
  - Numero incarico / ordine di servizio
  - Costo orario (€/ora, opzionale)
- Possibilità di aggiungere persone anche dopo la creazione

**Al termine:** il sistema crea automaticamente la struttura cartelle vuota e la checklist documenti iniziale.

---

### 4.3 Vista Progetto

**Layout a tabs:**

```
[Panoramica] [Persone] [Buste Paga] [Timecard] [Documenti] [Struttura Cartelle]
```

#### Tab Panoramica
- Riepilogo dati progetto (modificabili inline)
- Progress bar completezza per categoria documento
- Alert documenti urgenti mancanti
- Pulsante export zip
- Timeline scadenze trimestrali FSE+ (31/03, 30/06, 30/09, 31/12)

#### Tab Persone
- Lista persone con ruolo e ore totali estratte dalle buste paga
- Aggiunta / modifica / rimozione persone
- Per ogni persona: ore per mese (tabella riepilogativa)

#### Tab Buste Paga
Vedere sezione 4.4

#### Tab Timecard
Vedere sezione 4.5

#### Tab Documenti
Vedere sezione 4.6

#### Tab Struttura Cartelle
Vedere sezione 4.7

---

### 4.4 Upload e Parsing Buste Paga

**Flusso Upload:**
1. L'utente trascina uno o più PDF nella dropzone (o usa il file picker)
2. Il sistema avvia il parsing asincrono per ciascun PDF
3. Spinner di elaborazione per file
4. Risultato: nome estratto + ore estratte + mese rilevato

**Logica di Parsing (backend):**
- Estrazione testo con pdfplumber (Python)
- Ricerca pattern per:
  - Nome / Cognome: cerca campi tipici delle buste paga italiane (`COGNOME E NOME`, `Lavoratore`, intestazione)
  - Ore lavorate: cerca pattern come `Ore lavorate`, `Ore ordinarie`, `ORE LAVORATE NEL MESE`, valori numerici vicini a etichette di ore
  - Mese di competenza: cerca `COMPETENZA`, `PERIODO`, date in formato `MM/YYYY`
- **Matching persona:** una volta estratto nome+cognome, il sistema cerca corrispondenza nella lista persone del progetto
  - Match esatto → agganciato automaticamente
  - Match parziale → propone abbinamento, l'utente conferma
  - Nessun match → segnalato come "persona non trovata", l'utente abbina manualmente o aggiunge la persona

**UI Risultati Parsing:**
- Tabella con colonne: File | Nome Estratto | Persona Abbinata | Mese | Ore | Stato
- Stato:
  - ✅ Verde: parsing OK, persona abbinata
  - ⚠️ Giallo: ore estratte ma abbinamento persona da confermare
  - ❌ Rosso: parsing fallito, inserimento manuale richiesto
- Click su riga → modal di dettaglio con testo estratto e form di correzione manuale
- Possibilità di override manuale su qualsiasi campo

**Correzione Manuale:**
- Form semplice: seleziona persona dalla lista, inserisci mese, inserisci ore
- Il file PDF viene comunque conservato e associato

---

### 4.5 Generazione e Gestione Timecard

#### 4.5.1 Struttura Timecard

Ogni timecard copre **una persona** per **un mese** per **un progetto**.

**Header (fisso per progetto):**
- Loghi delle realtà partecipanti (riga superiore)
- Ente / Agenzia
- Codice Progetto
- Nome Progetto
- Denominazione Attività
- Nome e Cognome del lavoratore
- Mese di riferimento

**Corpo (tabella righe giornaliere):**

| Data | N° Ore | Orario | Descrizione Attività | Sede | N° Incarico |
|------|--------|--------|----------------------|------|-------------|
| gg/mm/aaaa | 4 | 09:00-13:00 | [testo] | [luogo] | [num] |

- Ogni riga = una giornata di lavoro
- Le ore totali del mese (dalla busta paga) devono corrispondere alla somma delle righe
- L'utente distribuisce le ore nei giorni manualmente o con assistenza del sistema

**Footer:**
- Totale ore mese
- Campo firma incaricato (nome + linea firma + data)
- Campo firma coordinatore/direttore (nome + ruolo + linea firma + data)

#### 4.5.2 Editor Timecard (UI)

**Prima generazione:**
- Il sistema crea una timecard vuota per ogni persona × mese con busta paga caricata
- Le ore totali del mese sono pre-impostate dal parsing della busta paga
- L'utente deve distribuire le ore nelle giornate

**Interfaccia editor:**
- Vista tabella editabile inline
- Aggiunta riga con click su "+ Aggiungi giorno"
- Auto-fill numero incarico dalla persona
- Contatore ore rimanenti da distribuire (totale busta paga − ore già inserite)
- Warning se si supera il totale della busta paga
- Salvataggio automatico (draft)

**Generazione PDF:**
- Pulsante "Genera PDF Timecard"
- Preview PDF nel browser prima del download
- Download singolo PDF
- Generazione batch: tutte le timecard del progetto in un colpo

#### 4.5.3 Layout PDF Timecard

- Formato A4 verticale
- Font: professionale, leggibile (es. Source Serif, IBM Plex)
- Header: loghi allineati in orizzontale, poi dati progetto/persona in box grigio chiaro
- Tabella: bordi sottili, alternanza riga chiara/bianca, intestazioni in grassetto
- Footer: due colonne (firma incaricato sx, firma coordinatore dx) con linee di firma
- Bordo sottile FSE+ / coesione su tutta la pagina (colore istituzionale: blu EU)
- Watermark "BOZZA" se non ancora firmata

---

### 4.6 Checklist Documenti Mancanti

#### 4.6.1 Logica di Generazione Checklist

Il sistema genera automaticamente la lista dei documenti richiesti in base a:
- **Modalità di rendicontazione** selezionata per il progetto
- **Ruoli delle persone** coinvolte (interno vs esterno determina documenti diversi)
- **Mesi coperti** dalle buste paga

La checklist è derivata dal **§ B.8 e B.10 del Manuale Beneficiari FSE+ Toscana**.

**Documenti per Personale Interno (per ogni persona × mese):**
- [ ] Busta paga
- [ ] Ordine di servizio (una tantum per persona)
- [ ] Prospetto calcolo costo orario (una tantum per persona)
- [ ] Timecard firmata
- [ ] F24 versamento ritenute (mensile)
- [ ] Ricevuta bonifico pagamento stipendio (mensile)

**Documenti per Personale Esterno (per ogni persona × contratto):**
- [ ] Lettera d'incarico
- [ ] Fattura / Notula
- [ ] Ricevuta bonifico pagamento
- [ ] F24 ritenute
- [ ] Timecard firmata
- [ ] CV sottoscritto

**Documenti di Progetto (generali):**
- [ ] Relazione finale (alla chiusura)
- [ ] Dichiarazione IRAP (se costi reali)
- [ ] Scheda finanziaria validata
- [ ] Copia conforme registri presenze / REC

#### 4.6.2 UI Checklist

**Vista per categoria:**
```
📁 Personale Interno
  👤 Mario Rossi
    ✅ Busta paga Gennaio 2025
    ✅ Ordine di servizio
    ⬜ Timecard Gennaio 2025 (MANCANTE)
    ⬜ F24 Gennaio 2025 (MANCANTE)
    ✅ Busta paga Febbraio 2025
    ⬜ Timecard Febbraio 2025 (MANCANTE)
  👤 Anna Bianchi
    ...

📁 Documenti di Progetto
  ⬜ Relazione finale (non ancora richiesta)
  ⬜ Dichiarazione IRAP
```

**Per ogni documento mancante:**
- Pulsante "Carica" → upload diretto
- Note / commenti
- Data caricamento e nome file

**Riepilogo in alto:**
- `X documenti mancanti su Y totali`
- Progress bar per categoria
- Export checklist come PDF (utile per audit interni)

---

### 4.7 Struttura Cartelle FSE+

#### 4.7.1 Struttura Generata (basata sul Manuale Beneficiari)

La struttura è generata in base alla modalità di rendicontazione. Esempio per **Staff + 40%**:

```
📁 [CODICE_PROGETTO]_[NOME_PROGETTO]/
│
├── 📁 01_CONTRATTI_E_INCARICHI/
│   ├── 📁 PERSONALE_INTERNO/
│   │   ├── 📁 ROSSI_MARIO/
│   │   │   └── ordine_di_servizio.pdf
│   │   └── 📁 BIANCHI_ANNA/
│   │       └── ordine_di_servizio.pdf
│   └── 📁 PERSONALE_ESTERNO/
│       └── 📁 VERDI_LUIGI/
│           └── lettera_incarico.pdf
│
├── 📁 02_BUSTE_PAGA/
│   ├── 📁 ROSSI_MARIO/
│   │   ├── busta_paga_2025_01.pdf
│   │   └── busta_paga_2025_02.pdf
│   └── 📁 BIANCHI_ANNA/
│       └── busta_paga_2025_01.pdf
│
├── 📁 03_PROSPETTI_COSTO_ORARIO/
│   ├── prospetto_ROSSI_MARIO.pdf
│   └── prospetto_BIANCHI_ANNA.pdf
│
├── 📁 04_TIMECARD/
│   ├── 📁 ROSSI_MARIO/
│   │   ├── timecard_2025_01_ROSSI_MARIO.pdf
│   │   └── timecard_2025_02_ROSSI_MARIO.pdf
│   └── 📁 BIANCHI_ANNA/
│       └── timecard_2025_01_BIANCHI_ANNA.pdf
│
├── 📁 05_PAGAMENTI/
│   ├── 📁 BONIFICI_STIPENDI/
│   └── 📁 F24/
│
├── 📁 06_FATTURE_PERSONALE_ESTERNO/
│   └── 📁 VERDI_LUIGI/
│
├── 📁 07_RELAZIONI_ATTIVITA/
│   ├── 📁 ROSSI_MARIO/
│   └── 📁 BIANCHI_ANNA/
│
└── 📁 08_DOCUMENTI_PROGETTO/
    ├── relazione_finale.pdf
    ├── scheda_finanziaria.pdf
    └── dichiarazione_irap.pdf
```

Per **Forfettizzazione 7%** e **Costi reali** viene aggiunta la sezione:
```
├── 📁 09_COSTI_DIRETTI/
│   ├── 📁 MATERIALI/
│   ├── 📁 ATTREZZATURE/
│   ├── 📁 LOCAZIONI/
│   └── 📁 SERVIZI/
└── 📁 10_COSTI_INDIRETTI/  (solo costi reali)
```

#### 4.7.2 UI Struttura Cartelle (nella webapp)

**Vista albero interattiva:**
- Icone cartella / file
- Click su cartella: espande/collassa
- Click su file: preview se PDF, download se altro
- Badge colorato per stato: 🟢 presente / 🔴 mancante / 🟡 da verificare
- Drag-and-drop per spostare file tra cartelle
- Pulsante "Rinomina" su ogni nodo
- Pulsante "Carica file" su ogni cartella
- Pulsante "Nuova cartella" per aggiunte custom

**Toolbar:**
- "Espandi tutto / Collassa tutto"
- "Mostra solo mancanti"
- "Scarica ZIP"

#### 4.7.3 Export ZIP

- Genera uno zip con la struttura cartelle completa
- Include tutti i file caricati nella posizione corretta
- Include le timecard PDF generate
- Include un file `CHECKLIST.pdf` riepilogativo dei documenti mancanti
- Nome zip: `[CODICE_PROGETTO]_rendiconto_[DATA].zip`
- Progress bar durante la generazione

---

## 5. Flusso Utente Principale (Happy Path)

```
1. Utente apre l'app
2. Dashboard: vede i progetti esistenti
3. Crea nuovo progetto →
   - Inserisce dati progetto
   - Sceglie modalità: Staff + 40%
   - Carica 2 loghi
   - Aggiunge 3 persone con ruoli e numero incarico
4. Il sistema genera struttura cartelle vuota + checklist iniziale
5. Va in "Buste Paga" → carica 6 PDF (2 persone × 3 mesi)
6. Il sistema parsa i PDF:
   - 5 ok con match automatico
   - 1 con nome non riconosciuto → utente abbina manualmente
7. Va in "Timecard":
   - Vede 6 timecard pre-create con ore precompilate
   - Per ciascuna: distribuisce le ore nei giorni, aggiunge descrizione attività e sede
   - Genera PDF di tutte e 6
8. Va in "Documenti":
   - Vede checklist con 18 documenti mancanti
   - Carica F24, bonifici
   - Carica ordini di servizio
9. Va in "Struttura Cartelle":
   - Vede l'albero con badge verdi e rossi
   - Scarica lo ZIP
```

---

## 6. Requisiti Non Funzionali

### 6.1 Performance
- Parsing busta paga PDF: completato in < 10 secondi per file
- Generazione timecard PDF: < 5 secondi per documento
- Generazione ZIP con 50+ documenti: < 30 secondi
- L'app deve essere utilizzabile offline dopo il primo caricamento (per la parte di editing)

### 6.2 Affidabilità
- Salvataggio automatico ogni 30 secondi nel form timecard
- Recovery da parsing fallito: il file viene conservato, l'utente può inserire dati manualmente
- Nessuna perdita di dati in caso di chiusura accidentale del browser

### 6.3 Sicurezza (anche se single-user)
- Tutti i file caricati salvati localmente sul server (non su cloud terzi)
- Se deployata su VPS: HTTPS obbligatorio
- Backup automatico del database (cron giornaliero)

### 6.4 Usabilità
- Interfaccia in italiano
- Messaggi di errore in italiano chiari e actionable ("Il PDF non contiene ore leggibili — inserisci manualmente")
- Nessun termine tecnico FSE+ non spiegato
- Funziona su Chrome, Firefox, Safari (desktop)
- Non richiesta ottimizzazione mobile (uso da desktop)

---

## 7. Struttura Voci PED per Checklist (Riferimento)

La checklist documenti è generata in base al ruolo della persona e alla voce PED a cui è imputata. Mapping di riferimento:

| Voce PED | Ruolo | Documenti Richiesti (interno) |
|----------|-------|-------------------------------|
| B.2.1.1/2/3 | Docente interno | OS, busta paga, costo orario, timecard (non richiesta se REC), F24, bonifico |
| B.2.2.1 | Tutor interno | OS, busta paga, costo orario, timecard, relazione attività, F24, bonifico |
| B.2.3.6 | Personale amm. interno | OS, busta paga, costo orario, timecard, relazione, F24, bonifico |
| B.4.1 | Direttore progetto interno | OS, busta paga, costo orario, timecard, relazione, F24, bonifico |
| B.4.5 | Coordinatore interno | OS, busta paga, costo orario, timecard, relazione, F24, bonifico |
| B.2.11.1 | Rendicontatore interno | OS, busta paga, costo orario, timecard, relazione, F24, bonifico |

| Voce PED | Ruolo | Documenti Richiesti (esterno) |
|----------|-------|-------------------------------|
| B.2.1.4/5/6 | Docente esterno | Lettera incarico, fattura/notula, timecard, ricevuta pagamento, F24, CV |
| B.2.2.2 | Tutor esterno | Lettera incarico, fattura/notula, timecard, relazione, ricevuta, F24, CV |
| B.4.2 | Direttore esterno | Lettera incarico, fattura/notula, timecard, relazione, ricevuta, F24, CV |

---

## 8. Roadmap

### v1.0 — MVP (priorità massima)
- [ ] Creazione e gestione progetti
- [ ] Upload e parsing buste paga PDF
- [ ] Match persona-busta paga
- [ ] Editor timecard con ore precompilate
- [ ] Generazione PDF timecard brandizzate
- [ ] Struttura cartelle FSE+ visualizzabile
- [ ] Checklist documenti mancanti base
- [ ] Export ZIP

### v1.1 — Post-MVP
- [ ] Template timecard personalizzabili (layout alternativo)
- [ ] Import lista persone da CSV
- [ ] Notifiche scadenze trimestrali (banner in-app)
- [ ] Export checklist come PDF
- [ ] Storico versioni documenti

### v2.0 — Futuro
- [ ] Multi-utente con ruoli (rendicontatore, direttore, amministratore)
- [ ] Supporto progetti UCS (Sezione C manuale)
- [ ] Integrazione con SI FSE regionale (se API disponibili)
- [ ] Dashboard analytics (spesa per voce PED, avanzamento per SAL)

---

## 9. Open Questions

1. **Parser buste paga:** il formato delle buste paga è sempre lo stesso software paghe? Se sì, vale la pena fare un parser specifico per quel formato invece di un parser generico. Da valutare sui file reali prima di sviluppare.

2. **Hosting:** l'app gira in locale sul computer della rendicontatrice, o su un server? Questo determina se serve un installer (Electron/Docker) o un semplice deploy su VPS.

3. **Autenticazione:** anche per utente singolo, è utile avere una password di accesso? Consigliato sì, anche solo una password configurabile da file `.env`.

4. **Timecard — distribuzione ore:** quando le ore totali del mese sono estratte dalla busta paga, c'è una logica per distribuirle automaticamente nei giorni lavorativi (es. 8 ore per giorno fino a esaurimento), o l'utente preferisce farlo sempre manualmente?

5. **Firma timecard:** la firma è fisica (stampa + firma + scansione) o si vuole pensare a una firma digitale in futuro? In v1.0 si assume firma fisica.

6. **Formato buste paga:** prima di sviluppare il parser, è necessario testare su almeno 3-5 buste paga reali (oscurate) per validare i pattern di estrazione.

---

## 10. Glossario

| Termine | Definizione |
|---------|-------------|
| FSE+ | Fondo Sociale Europeo Plus — fondo europeo per occupazione e formazione |
| PR FSE+ | Programma Regionale FSE+ Toscana 2021-2027 |
| PED | Piano Economico di Dettaglio — schema di riferimento finanziario del progetto |
| SAL | Stato Avanzamento Lavori — rendicontazione trimestrale intermedia |
| Timecard | Foglio presenze del personale che attesta ore e attività svolte nel progetto |
| Staff + 40% | Modalità rendicontazione: solo costi personale + 40% forfait altri costi |
| Forfettizzazione 7% | Modalità: tutti costi diretti + 7% forfait costi indiretti |
| Costi reali | Modalità: tutti i costi diretti e indiretti documentati singolarmente |
| SI FSE | Sistema Informativo regionale FSE — portale per inserimento dati e giustificativi |
| Voce PED | Categoria di spesa specifica nel Piano Economico (es. B.2.1.1 Docente junior interno) |
| Personale interno | Dipendente del beneficiario legato da contratto subordinato |
| Personale esterno | Collaboratore con rapporto non dipendente (co.co.co., P.IVA, ecc.) |

---

*Fine PRD v1.0*
