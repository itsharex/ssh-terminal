import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const isTerminalPage = location.pathname === "/" || location.pathname === "/terminal";

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - 始终显示 */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar - 在终端页面隐藏 */}
        {!isTerminalPage && <TopBar />}

        {/* Page Content */}
        <main className={cn(
          "flex-1",
          isTerminalPage ? "overflow-hidden h-full" : "bg-muted/20 overflow-y-auto custom-scrollbar"
        )}>
          {isTerminalPage ? (
            // 终端页面全屏显示
            <div className="h-full">{children}</div>
          ) : (
            // 其他页面正常显示
            <div className="p-6">{children}</div>
          )}
        </main>
      </div>
    </div>
  );
}
