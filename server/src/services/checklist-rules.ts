import type { ChecklistRules } from "../../../shared/types.ts";

export const FSE_PLUS_RULES: ChecklistRules = {
  docs_interno: [
    { categoria: "ordine_servizio", descrizione: "Ordine di servizio", perMese: false, unaTantum: true },
    { categoria: "prospetto_costo_orario", descrizione: "Prospetto calcolo costo orario", perMese: false, unaTantum: true },
    { categoria: "busta_paga", descrizione: "Busta paga", perMese: true, unaTantum: false },
    { categoria: "timecard", descrizione: "Timecard firmata", perMese: true, unaTantum: false },
    { categoria: "f24", descrizione: "F24 versamento ritenute", perMese: true, unaTantum: false },
    { categoria: "bonifico", descrizione: "Ricevuta bonifico stipendio", perMese: true, unaTantum: false },
  ],
  docs_interno_con_relazione: [
    { categoria: "ordine_servizio", descrizione: "Ordine di servizio", perMese: false, unaTantum: true },
    { categoria: "prospetto_costo_orario", descrizione: "Prospetto calcolo costo orario", perMese: false, unaTantum: true },
    { categoria: "busta_paga", descrizione: "Busta paga", perMese: true, unaTantum: false },
    { categoria: "timecard", descrizione: "Timecard firmata", perMese: true, unaTantum: false },
    { categoria: "f24", descrizione: "F24 versamento ritenute", perMese: true, unaTantum: false },
    { categoria: "bonifico", descrizione: "Ricevuta bonifico stipendio", perMese: true, unaTantum: false },
    { categoria: "relazione_attivita", descrizione: "Relazione attività", perMese: false, unaTantum: true },
  ],
  ruoli_con_relazione: ["tutor_interno", "amministrativo", "direttore_interno", "coordinatore", "rendicontatore"],
  docs_esterno: [
    { categoria: "lettera_incarico", descrizione: "Lettera d'incarico", perMese: false, unaTantum: true },
    { categoria: "cv", descrizione: "CV sottoscritto", perMese: false, unaTantum: true },
    { categoria: "fattura", descrizione: "Fattura / Notula", perMese: true, unaTantum: false },
    { categoria: "timecard", descrizione: "Timecard firmata", perMese: true, unaTantum: false },
    { categoria: "f24", descrizione: "F24 ritenute", perMese: true, unaTantum: false },
    { categoria: "bonifico", descrizione: "Ricevuta pagamento", perMese: true, unaTantum: false },
    { categoria: "relazione_attivita", descrizione: "Relazione attività", perMese: false, unaTantum: true },
  ],
  docs_progetto: [
    { categoria: "scheda_finanziaria", descrizione: "Scheda finanziaria validata", perMese: false, unaTantum: true },
    { categoria: "relazione_finale", descrizione: "Relazione finale", perMese: false, unaTantum: true },
  ],
  docs_per_mode: {
    costi_reali: [
      { categoria: "dichiarazione_irap", descrizione: "Dichiarazione IRAP", perMese: false, unaTantum: false },
    ],
  },
};

export const PNRR_RULES: ChecklistRules = {
  docs_interno: [
    { categoria: "ordine_servizio", descrizione: "Ordine di servizio / Decreto", perMese: false, unaTantum: true },
    { categoria: "prospetto_costo_orario", descrizione: "Prospetto calcolo costo orario", perMese: false, unaTantum: true },
    { categoria: "busta_paga", descrizione: "Busta paga", perMese: true, unaTantum: false },
    { categoria: "timecard", descrizione: "Timecard firmata", perMese: true, unaTantum: false },
    { categoria: "f24", descrizione: "F24 versamento ritenute", perMese: true, unaTantum: false },
    { categoria: "bonifico", descrizione: "Ricevuta bonifico stipendio", perMese: true, unaTantum: false },
    { categoria: "registri_presenze", descrizione: "Registro presenze", perMese: true, unaTantum: false },
  ],
  docs_interno_con_relazione: [
    { categoria: "ordine_servizio", descrizione: "Ordine di servizio / Decreto", perMese: false, unaTantum: true },
    { categoria: "prospetto_costo_orario", descrizione: "Prospetto calcolo costo orario", perMese: false, unaTantum: true },
    { categoria: "busta_paga", descrizione: "Busta paga", perMese: true, unaTantum: false },
    { categoria: "timecard", descrizione: "Timecard firmata", perMese: true, unaTantum: false },
    { categoria: "f24", descrizione: "F24 versamento ritenute", perMese: true, unaTantum: false },
    { categoria: "bonifico", descrizione: "Ricevuta bonifico stipendio", perMese: true, unaTantum: false },
    { categoria: "registri_presenze", descrizione: "Registro presenze", perMese: true, unaTantum: false },
    { categoria: "relazione_attivita", descrizione: "Relazione attività", perMese: false, unaTantum: true },
  ],
  ruoli_con_relazione: ["tutor_interno", "amministrativo", "direttore_interno", "coordinatore", "rendicontatore"],
  docs_esterno: [
    { categoria: "lettera_incarico", descrizione: "Lettera d'incarico / Contratto", perMese: false, unaTantum: true },
    { categoria: "cv", descrizione: "CV sottoscritto", perMese: false, unaTantum: true },
    { categoria: "fattura", descrizione: "Fattura / Notula", perMese: true, unaTantum: false },
    { categoria: "timecard", descrizione: "Timecard firmata", perMese: true, unaTantum: false },
    { categoria: "f24", descrizione: "F24 ritenute", perMese: true, unaTantum: false },
    { categoria: "bonifico", descrizione: "Ricevuta pagamento", perMese: true, unaTantum: false },
    { categoria: "relazione_attivita", descrizione: "Relazione attività", perMese: false, unaTantum: true },
  ],
  docs_progetto: [
    { categoria: "scheda_finanziaria", descrizione: "Scheda finanziaria validata", perMese: false, unaTantum: true },
    { categoria: "relazione_finale", descrizione: "Relazione finale", perMese: false, unaTantum: true },
    { categoria: "registri_presenze", descrizione: "Registri presenze allievi", perMese: false, unaTantum: true },
  ],
  docs_per_mode: {
    costi_reali: [
      { categoria: "dichiarazione_irap", descrizione: "Dichiarazione IRAP", perMese: false, unaTantum: false },
    ],
  },
};

export const ERASMUS_PLUS_RULES: ChecklistRules = {
  docs_interno: [
    { categoria: "ordine_servizio", descrizione: "Ordine di servizio", perMese: false, unaTantum: true },
    { categoria: "busta_paga", descrizione: "Busta paga", perMese: true, unaTantum: false },
    { categoria: "timecard", descrizione: "Timecard firmata", perMese: true, unaTantum: false },
    { categoria: "bonifico", descrizione: "Ricevuta bonifico stipendio", perMese: true, unaTantum: false },
  ],
  docs_interno_con_relazione: [
    { categoria: "ordine_servizio", descrizione: "Ordine di servizio", perMese: false, unaTantum: true },
    { categoria: "busta_paga", descrizione: "Busta paga", perMese: true, unaTantum: false },
    { categoria: "timecard", descrizione: "Timecard firmata", perMese: true, unaTantum: false },
    { categoria: "bonifico", descrizione: "Ricevuta bonifico stipendio", perMese: true, unaTantum: false },
    { categoria: "relazione_attivita", descrizione: "Relazione attività", perMese: false, unaTantum: true },
  ],
  ruoli_con_relazione: ["tutor_interno", "amministrativo", "direttore_interno", "coordinatore", "rendicontatore"],
  docs_esterno: [
    { categoria: "lettera_incarico", descrizione: "Lettera d'incarico", perMese: false, unaTantum: true },
    { categoria: "cv", descrizione: "CV sottoscritto", perMese: false, unaTantum: true },
    { categoria: "fattura", descrizione: "Fattura / Notula", perMese: true, unaTantum: false },
    { categoria: "timecard", descrizione: "Timecard firmata", perMese: true, unaTantum: false },
    { categoria: "bonifico", descrizione: "Ricevuta pagamento", perMese: true, unaTantum: false },
    { categoria: "relazione_attivita", descrizione: "Relazione attività", perMese: false, unaTantum: true },
  ],
  docs_progetto: [
    { categoria: "scheda_finanziaria", descrizione: "Scheda finanziaria validata", perMese: false, unaTantum: true },
    { categoria: "relazione_finale", descrizione: "Relazione finale", perMese: false, unaTantum: true },
  ],
  docs_per_mode: {},
};

export const PON_RULES: ChecklistRules = {
  docs_interno: [
    { categoria: "ordine_servizio", descrizione: "Ordine di servizio", perMese: false, unaTantum: true },
    { categoria: "prospetto_costo_orario", descrizione: "Prospetto calcolo costo orario", perMese: false, unaTantum: true },
    { categoria: "busta_paga", descrizione: "Busta paga", perMese: true, unaTantum: false },
    { categoria: "timecard", descrizione: "Timecard firmata", perMese: true, unaTantum: false },
    { categoria: "f24", descrizione: "F24 versamento ritenute", perMese: true, unaTantum: false },
    { categoria: "bonifico", descrizione: "Ricevuta bonifico stipendio", perMese: true, unaTantum: false },
    { categoria: "registri_presenze", descrizione: "Registro presenze", perMese: true, unaTantum: false },
  ],
  docs_interno_con_relazione: [
    { categoria: "ordine_servizio", descrizione: "Ordine di servizio", perMese: false, unaTantum: true },
    { categoria: "prospetto_costo_orario", descrizione: "Prospetto calcolo costo orario", perMese: false, unaTantum: true },
    { categoria: "busta_paga", descrizione: "Busta paga", perMese: true, unaTantum: false },
    { categoria: "timecard", descrizione: "Timecard firmata", perMese: true, unaTantum: false },
    { categoria: "f24", descrizione: "F24 versamento ritenute", perMese: true, unaTantum: false },
    { categoria: "bonifico", descrizione: "Ricevuta bonifico stipendio", perMese: true, unaTantum: false },
    { categoria: "registri_presenze", descrizione: "Registro presenze", perMese: true, unaTantum: false },
    { categoria: "relazione_attivita", descrizione: "Relazione attività", perMese: false, unaTantum: true },
  ],
  ruoli_con_relazione: ["tutor_interno", "amministrativo", "direttore_interno", "coordinatore", "rendicontatore"],
  docs_esterno: [
    { categoria: "lettera_incarico", descrizione: "Lettera d'incarico", perMese: false, unaTantum: true },
    { categoria: "cv", descrizione: "CV sottoscritto", perMese: false, unaTantum: true },
    { categoria: "fattura", descrizione: "Fattura / Notula", perMese: true, unaTantum: false },
    { categoria: "timecard", descrizione: "Timecard firmata", perMese: true, unaTantum: false },
    { categoria: "f24", descrizione: "F24 ritenute", perMese: true, unaTantum: false },
    { categoria: "bonifico", descrizione: "Ricevuta pagamento", perMese: true, unaTantum: false },
    { categoria: "relazione_attivita", descrizione: "Relazione attività", perMese: false, unaTantum: true },
  ],
  docs_progetto: [
    { categoria: "scheda_finanziaria", descrizione: "Scheda finanziaria validata", perMese: false, unaTantum: true },
    { categoria: "relazione_finale", descrizione: "Relazione finale", perMese: false, unaTantum: true },
    { categoria: "registri_presenze", descrizione: "Registri presenze allievi", perMese: false, unaTantum: true },
  ],
  docs_per_mode: {
    costi_reali: [
      { categoria: "dichiarazione_irap", descrizione: "Dichiarazione IRAP", perMese: false, unaTantum: false },
    ],
  },
};

export const BUILTIN_TIPOLOGIE = [
  { codice: "fse_plus", nome: "FSE+", descrizione: "Fondo Sociale Europeo Plus", regole: FSE_PLUS_RULES },
  { codice: "pnrr", nome: "PNRR", descrizione: "Piano Nazionale di Ripresa e Resilienza", regole: PNRR_RULES },
  { codice: "erasmus_plus", nome: "Erasmus+", descrizione: "Programma Erasmus Plus", regole: ERASMUS_PLUS_RULES },
  { codice: "pon", nome: "PON", descrizione: "Programma Operativo Nazionale", regole: PON_RULES },
] as const;
