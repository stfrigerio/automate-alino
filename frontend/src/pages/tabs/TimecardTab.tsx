import { useEffect, useState } from "react";
import { getTimecards } from "../../api/client";
import type { Timecard } from "../../types";
import { Clock } from "lucide-react";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import styles from "./TimecardTab.module.css";

type TimecardRow = Timecard & {
  persona_nome: string;
  persona_cognome: string;
  ore_previste?: number;
};

type BadgeVariant = "neutral" | "info" | "success";

const STATO_BADGE: Record<string, { variant: BadgeVariant; label: string }> = {
  bozza: { variant: "neutral", label: "Bozza" },
  generata: { variant: "info", label: "Generata" },
  firmata: { variant: "success", label: "Firmata" },
};

export default function TimecardTab({ projectId }: { projectId: string }) {
  const [timecards, setTimecards] = useState<TimecardRow[]>([]);

  useEffect(() => {
    getTimecards(projectId).then(setTimecards);
  }, [projectId]);

  if (timecards.length === 0) {
    return (
      <EmptyState icon={Clock}>
        Nessuna timecard. Le timecard vengono create automaticamente quando carichi le buste paga.
      </EmptyState>
    );
  }

  return (
    <div>
      <h2 className={styles.title}>Timecard ({timecards.length})</h2>

      <table className={styles.table}>
        <thead>
          <tr className={styles.tableHead}>
            <th className={styles.th}>Persona</th>
            <th className={styles.th}>Mese</th>
            <th className={styles.thRight}>Ore</th>
            <th className={styles.th}>Stato</th>
          </tr>
        </thead>
        <tbody>
          {timecards.map((tc) => {
            const badge = STATO_BADGE[tc.stato] ?? STATO_BADGE.bozza;
            const orePreviste = tc.ore_previste ?? null;
            return (
              <tr key={tc.id} className={styles.row}>
                <td className={styles.tdBold}>
                  {tc.persona_cognome} {tc.persona_nome}
                </td>
                <td className={styles.tdMuted}>{tc.mese}</td>
                <td className={styles.tdRight}>
                  <span className={orePreviste != null && tc.ore_totali >= orePreviste ? styles.oreOk : orePreviste != null ? styles.oreIncomplete : ""}>
                    {tc.ore_totali}h
                  </span>
                  {orePreviste != null && (
                    <>
                      <span className={styles.oreSeparator}>/</span>
                      <span className={styles.oreTotal}>{orePreviste}h</span>
                    </>
                  )}
                </td>
                <td className={styles.td}>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
