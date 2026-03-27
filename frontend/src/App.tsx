import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProjectList from "./pages/ProjectList";
import NewProject from "./pages/NewProject";
import ProjectView from "./pages/ProjectView";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-12 px-4">
          <Routes>
            <Route path="/" element={<ProjectList />} />
            <Route path="/projects/new" element={<NewProject />} />
            <Route path="/projects/:id" element={<ProjectView />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
