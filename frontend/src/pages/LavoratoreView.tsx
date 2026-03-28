import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getLavoratore } from "../api/client";
import GlobalBustePaga from "./GlobalBustePaga";
import { Breadcrumb } from "../components/Breadcrumb";
import NavControls from "../components/NavControls";
import styles from "./LavoratoreView.module.css";

type LavoratoreDetail = {
  id: string;
  nome: string;
  cognome: string;
  codice_fiscale?: string;
  progetti: { id: string; progetto_nome: string; codice_progetto: string }[];
};

export default function LavoratoreView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lavoratore, setLavoratore] = useState<LavoratoreDetail | null>(null);

  useEffect(() => {
    if (id) getLavoratore(id).then(setLavoratore);
  }, [id]);

  if (!lavoratore) return null;

  return (
    <div className={styles.page}>
      <Breadcrumb
        items={[
          { label: "Home", to: "/" },
          { label: `${lavoratore.cognome} ${lavoratore.nome}` },
        ]}
        end={<NavControls />}
      />

      <div className={styles.header}>
        <h1 className={styles.title}>
          {lavoratore.cognome} {lavoratore.nome}
        </h1>
        {lavoratore.codice_fiscale && (
          <span className={styles.cf}>{lavoratore.codice_fiscale}</span>
        )}
      </div>

      {lavoratore.progetti.length > 0 && (
        <div className={styles.progetti}>
          {lavoratore.progetti.map((p) => (
            <button
              key={p.id}
              className={styles.progettoChip}
              onClick={() => navigate(`/projects/${p.id}`)}
            >
              <span className={styles.progettoCode}>{p.codice_progetto}</span>
              <span className={styles.progettoNome}>{p.progetto_nome}</span>
            </button>
          ))}
        </div>
      )}

      <GlobalBustePaga lavoratoreId={id} />
    </div>
  );
}
