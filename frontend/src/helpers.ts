import type { RuoloPersonale, TipoPersonale, RendicontazioneMode, DocumentStatus } from "./types";

const RUOLI_ESTERNI: RuoloPersonale[] = [
  "docente_esterno",
  "tutor_esterno",
  "direttore_esterno",
];

export function tipoFromRuolo(ruolo: RuoloPersonale): TipoPersonale {
  return RUOLI_ESTERNI.includes(ruolo) ? "esterno" : "interno";
}

export const RUOLO_LABELS: Record<RuoloPersonale, string> = {
  docente_interno: "Docente interno",
  docente_esterno: "Docente esterno",
  tutor_interno: "Tutor interno",
  tutor_esterno: "Tutor esterno",
  coordinatore: "Coordinatore",
  direttore_interno: "Direttore progetto interno",
  direttore_esterno: "Direttore progetto esterno",
  amministrativo: "Personale amministrativo",
  rendicontatore: "Rendicontatore",
};

export const RENDICONTAZIONE_LABELS: Record<RendicontazioneMode, string> = {
  staff_40: "Staff + 40%",
  forfettario_7: "Forfettizzazione 7%",
  costi_reali: "Costi reali",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  mancante: "Mancante",
  caricato: "Caricato",
  verificato: "Verificato",
};
