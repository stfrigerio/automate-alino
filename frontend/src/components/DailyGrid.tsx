import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { OreGiornaliere, CategoriaOreNonProgetto } from "../types";
import { ORE_NON_PROGETTO_LABELS } from "../helpers";
import styles from "./DailyGrid.module.css";

const GIORNI_SETTIMANA = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const CATEGORIE_NON_PROGETTO = Object.keys(ORE_NON_PROGETTO_LABELS) as CategoriaOreNonProgetto[];

const PROJECT_PALETTE = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1",
  "#ef4444", "#84cc16",
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function contrastColor(hex: string): "#ffffff" | "#111827" {
  const [r, g, b] = hexToRgb(hex);
  const lum = [r, g, b]
    .map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); })
    .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);
  return lum > 0.179 ? "#111827" : "#ffffff";
}

export interface ProgettoOption {
  progetto_id: string;
  progetto_nome: string;
  codice_progetto: string;
  persona_id: string;
  color?: string;
}

export interface AllocazioneDayState {
  progetto_id?: string;
  persona_id?: string;
  categoria_non_progetto?: CategoriaOreNonProgetto;
}

interface DailyGridProps {
  mese: string;
  oreGiornaliere: OreGiornaliere[];
  progetti: ProgettoOption[];
  allocazioniMap: Map<number, AllocazioneDayState>;
  onAllocaGiorno: (giorno: number, alloc: AllocazioneDayState | null) => void;
  saving?: boolean;
}

interface PopoverState {
  giorno: number;
  x: number;
  y: number;
}

export function DailyGrid({ mese, oreGiornaliere, progetti, allocazioniMap, onAllocaGiorno, saving }: DailyGridProps) {
  const [year, month] = mese.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const byDay = new Map(oreGiornaliere.map((g) => [g.giorno, g]));
  const [popover, setPopover] = useState<PopoverState | null>(null);

  const projectColors = new Map(
    progetti.map((p, i) => {
      const bg = p.color ?? PROJECT_PALETTE[i % PROJECT_PALETTE.length];
      return [p.progetto_id, { bg, text: contrastColor(bg) }];
    })
  );

  const handleDayClick = (e: React.MouseEvent<HTMLButtonElement>, giorno: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const POPOVER_WIDTH = 240;
    let x = rect.left;
    if (x + POPOVER_WIDTH > window.innerWidth) {
      x = Math.max(4, rect.right - POPOVER_WIDTH);
    }
    const POPOVER_HEIGHT = 300;
    const y = rect.bottom + 4 + POPOVER_HEIGHT > window.innerHeight
      ? rect.top - POPOVER_HEIGHT - 4
      : rect.bottom + 4;
    setPopover({ giorno, x, y });
  };

  const handleSelect = (giorno: number, alloc: AllocazioneDayState | null) => {
    onAllocaGiorno(giorno, alloc);
    setPopover(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPopover(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={styles.dailyGrid}>
      <div className={styles.dailyHeader}>Presenze giornaliere</div>
      <div className={styles.daysList}>
        {days.map((d) => {
          const g = byDay.get(d);
          const workHours = g ? g.ordinarie + g.straordinario : 0;
          const hasAssenza = g ? g.assenza > 0 : false;
          const dayOfWeek = new Date(year, month - 1, d).getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const alloc = allocazioniMap.get(d);
          const projectColor = alloc?.progetto_id ? projectColors.get(alloc.progetto_id) : null;
          const isClickable = workHours > 0 && progetti.length > 0;

          const cellClass = [
            styles.dayCell,
            workHours > 0 && !alloc ? styles.dayCellActive : "",
            hasAssenza && workHours === 0 ? styles.dayCellAssenza : "",
            isWeekend ? styles.dayCellWeekend : "",
            isClickable ? styles.dayCellClickable : "",
          ].filter(Boolean).join(" ");

          const cellStyle = projectColor
            ? { backgroundColor: projectColor.bg }
            : alloc?.categoria_non_progetto
            ? { backgroundColor: "var(--color-warning-bg)" }
            : undefined;

          const allocProject = alloc?.progetto_id ? progetti.find((p) => p.progetto_id === alloc.progetto_id) : null;
          const tooltipLabel = allocProject
            ? `${allocProject.progetto_nome} (${workHours}h)`
            : alloc?.categoria_non_progetto
            ? `Non progetto: ${ORE_NON_PROGETTO_LABELS[alloc.categoria_non_progetto]} (${workHours}h)`
            : hasAssenza && workHours === 0
            ? `Assenza dalla busta paga: ${g!.assenza}h`
            : workHours > 0
            ? `${workHours}h lavorative — non allocate`
            : null;

          const textColor = projectColor?.text;
          const inner = (
            <>
              <span className={styles.dayWeekday} style={textColor ? { color: textColor } : undefined}>{GIORNI_SETTIMANA[dayOfWeek]}</span>
              <span className={styles.dayNumber} style={textColor ? { color: textColor } : undefined}>{d}</span>
              {workHours > 0 && (
                <span className={styles.dayHours} style={textColor ? { color: textColor } : undefined}>
                  {workHours}
                </span>
              )}
              {hasAssenza && workHours === 0 && <span className={styles.dayHoursAssenza}>{g!.assenza}</span>}
              {tooltipLabel && <span className={styles.dayTooltip}>{tooltipLabel}</span>}
            </>
          );

          if (isClickable) {
            return (
              <button
                key={d}
                className={cellClass}
                style={cellStyle}
                onClick={(e) => handleDayClick(e, d)}
                disabled={saving}
              >
                {inner}
              </button>
            );
          }
          return (
            <div key={d} className={cellClass} style={cellStyle}>
              {inner}
            </div>
          );
        })}
      </div>

      {popover &&
        createPortal(
          <>
            <div className={styles.popoverBackdrop} onClick={() => setPopover(null)} />
            <div className={styles.popover} style={{ left: popover.x, top: popover.y }}>
              <div className={styles.popoverSection}>
                <div className={styles.popoverSectionTitle}>Progetto</div>
                {progetti.map((p, i) => {
                  const bg = p.color ?? PROJECT_PALETTE[i % PROJECT_PALETTE.length];
                  const isSelected = allocazioniMap.get(popover.giorno)?.progetto_id === p.progetto_id;
                  return (
                    <button
                      key={p.progetto_id}
                      className={`${styles.popoverOption} ${isSelected ? styles.popoverOptionSelected : ""}`}
                      onClick={() => handleSelect(popover.giorno, { progetto_id: p.progetto_id, persona_id: p.persona_id })}
                    >
                      <span className={styles.colorDot} style={{ backgroundColor: bg }} />
                      <span className={styles.popoverOptionCode}>{p.codice_progetto}</span>
                      <span className={styles.popoverOptionName}>{p.progetto_nome}</span>
                    </button>
                  );
                })}
              </div>
              <div className={styles.popoverDivider} />
              <div className={styles.popoverSection}>
                <div className={styles.popoverSectionTitle}>Non progetto</div>
                {CATEGORIE_NON_PROGETTO.map((cat) => {
                  const isSelected = allocazioniMap.get(popover.giorno)?.categoria_non_progetto === cat;
                  return (
                    <button
                      key={cat}
                      className={`${styles.popoverOption} ${isSelected ? styles.popoverOptionSelected : ""}`}
                      onClick={() => handleSelect(popover.giorno, { categoria_non_progetto: cat })}
                    >
                      <span className={styles.colorDotNp} />
                      <span className={styles.popoverOptionCode}>{ORE_NON_PROGETTO_LABELS[cat]}</span>
                    </button>
                  );
                })}
              </div>
              {allocazioniMap.has(popover.giorno) && (
                <>
                  <div className={styles.popoverDivider} />
                  <button
                    className={`${styles.popoverOption} ${styles.popoverOptionRemove}`}
                    onClick={() => handleSelect(popover.giorno, null)}
                  >
                    <X size={12} />
                    <span className={styles.popoverOptionCode}>Rimuovi allocazione</span>
                  </button>
                </>
              )}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
