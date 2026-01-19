import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Terminal } from "@/pages/Terminal";
import { SessionManager } from "@/pages/SessionManager";
import { Settings } from "@/pages/Settings";
import { ThemeProvider } from "@/components/theme-provider";

function App() {
  return (
    <Router>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <MainLayout>
          <Routes>
            <Route path="/" element={<Terminal />} />
            <Route path="/terminal" element={<Terminal />} />
            <Route path="/sessions" element={<SessionManager />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </MainLayout>
      </ThemeProvider>
    </Router>
  );
}

export default App;
