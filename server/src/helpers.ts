import type { RuoloPersonale, TipoPersonale } from "../../shared/types.ts";

const RUOLI_ESTERNI: RuoloPersonale[] = [
  "docente_esterno",
  "tutor_esterno",
  "direttore_esterno",
];

export function tipoFromRuolo(ruolo: RuoloPersonale): TipoPersonale {
  return RUOLI_ESTERNI.includes(ruolo) ? "esterno" : "interno";
}
