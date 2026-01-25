import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Terminal } from "@/pages/Terminal";
import { SessionManager } from "@/pages/SessionManager";
import { Settings } from "@/pages/Settings";
import { SftpManager } from "@/pages/SftpManager";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { useTerminalConfigStore } from "@/store/terminalConfigStore";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { MobileSessionList } from "@/components/mobile/MobileSessionList";
import { MobileTerminalPage } from "@/components/mobile/MobileTerminalPage";
import { isMobileDevice, isAndroid, isIOS } from "@/lib/utils";

function App() {
  const loadConfig = useTerminalConfigStore(state => state.loadConfig);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 检测设备类型
  const isMobile = isMobileDevice();
  const isAndroidDevice = isAndroid();
  const isIOSDevice = isIOS();

  // 根据设备类型设置body类
  useEffect(() => {
    if (isMobile) {
      document.body.classList.add('mobile');
      if (isAndroidDevice) {
        document.body.classList.add('android');
      } else if (isIOSDevice) {
        document.body.classList.add('ios');
      }
    } else {
      document.body.classList.remove('mobile', 'android', 'ios');
    }
  }, [isMobile, isAndroidDevice, isIOSDevice]);

  if (isMobile) {
    return (
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <Router>
          <MobileLayout>
            <Routes>
              <Route path="/" element={<MobileSessionList />} />
              <Route path="/terminal" element={<MobileTerminalPage />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </MobileLayout>
        </Router>
        <Toaster position="top-center" />
      </ThemeProvider>
    );
  }

  return (
    <Router>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <MainLayout>
          <Routes>
            <Route path="/" element={<Terminal />} />
            <Route path="/terminal" element={<Terminal />} />
            <Route path="/sessions" element={<SessionManager />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/sftp" element={<SftpManager />} />
          </Routes>
        </MainLayout>
        <Toaster position="top-center" />
      </ThemeProvider>
    </Router>
  );
}

export default App;
