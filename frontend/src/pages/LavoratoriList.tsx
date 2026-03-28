import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getLavoratori, createLavoratore } from "../api/client";
import type { Lavoratore, CreateLavoratoreRequest } from "../types";
import { motion } from "motion/react";
import { Plus, Users } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import styles from "./LavoratoriList.module.css";

type LavoratoreRow = Lavoratore & { num_progetti: number; num_buste_paga: number };

export default function LavoratoriList() {
  const navigate = useNavigate();
  const [lavoratori, setLavoratori] = useState<LavoratoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [codiceFiscale, setCodiceFiscale] = useState("");

  const load = () =>
    getLavoratori()
      .then(setLavoratori)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    if (!nome.trim() || !cognome.trim()) return;
    const data: CreateLavoratoreRequest = {
      nome: nome.trim(),
      cognome: cognome.trim(),
      codice_fiscale: codiceFiscale.trim() || undefined,
    };
    await createLavoratore(data);
    setNome("");
    setCognome("");
    setCodiceFiscale("");
    setShowForm(false);
    load();
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Lavoratori</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className={styles.addButton}
        >
          <Plus size={16} />
          Aggiungi lavoratore
        </button>
      </div>

      {showForm && (
        <div className={styles.form}>
          <div className={styles.formGrid}>
            <input
              type="text"
              placeholder="Nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={styles.input}
            />
            <input
              type="text"
              placeholder="Cognome"
              value={cognome}
              onChange={(e) => setCognome(e.target.value)}
              className={styles.input}
            />
            <input
              type="text"
              placeholder="Codice fiscale (opzionale)"
              value={codiceFiscale}
              onChange={(e) => setCodiceFiscale(e.target.value)}
              className={styles.input}
            />
          </div>
          <div className={styles.formButtons}>
            <button onClick={handleAdd} className={styles.saveButton}>
              Salva
            </button>
            <button
              onClick={() => setShowForm(false)}
              className={styles.cancelButton}
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {loading && <p className={styles.loading}>Caricamento...</p>}

      {!loading && lavoratori.length === 0 && (
        <EmptyState icon={Users}>
          Nessun lavoratore. I lavoratori interni vengono creati automaticamente
          quando aggiungi persone ai progetti.
        </EmptyState>
      )}

      {!loading && lavoratori.length > 0 && (
        <div className={styles.cards}>
          {lavoratori.map((l, i) => (
            <motion.button
              key={l.id}
              className={styles.card}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              onClick={() => navigate(`/lavoratori/${l.id}`)}
            >
              <div className={styles.avatar}>
                {l.cognome[0]}{l.nome[0]}
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardName}>{l.cognome} {l.nome}</div>
                <div className={styles.cardMeta}>
                  <span>{l.num_progetti} {l.num_progetti === 1 ? "progetto" : "progetti"}</span>
                  <span className={styles.dot}>·</span>
                  <span>{l.num_buste_paga} {l.num_buste_paga === 1 ? "busta paga" : "buste paga"}</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
