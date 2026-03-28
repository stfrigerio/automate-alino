import { BrowserRouter, Routes, Route } from "react-router-dom";
import Homepage from "./pages/Homepage";
import NewProject from "./pages/NewProject";
import ProjectView from "./pages/ProjectView";
import LavoratoreView from "./pages/LavoratoreView";
import DocumentiArchivio from "./pages/DocumentiArchivio";
import { NotificationProvider } from "./context/NotificationContext";
import styles from "./App.module.css";

export default function App() {
  return (
    <NotificationProvider>
      <BrowserRouter>
        <div className={styles.layout}>
          <div className={styles.container}>
            <Routes>
              <Route path="/" element={<Homepage />} />
              <Route path="/projects/new" element={<NewProject />} />
              <Route path="/projects/:id" element={<ProjectView />} />
              <Route path="/lavoratori/:id" element={<LavoratoreView />} />
              <Route path="/documenti" element={<DocumentiArchivio />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </NotificationProvider>
  );
}
