import { NavLink } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Terminal,
  FolderOpen,
  HardDrive,
  Settings,
  MessageSquare,
  LucideIcon,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import { useSidebarStore } from "@/store/sidebarStore";
import { cn } from "@/lib/utils";
import { UserArea } from "@/components/user/UserArea";
import { useAuthStore } from "@/store/authStore";
import { useTranslation } from 'react-i18next';

interface NavigationItem {
  name: string;
  path: string;
  icon: LucideIcon;
}

interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

export function Sidebar() {
  const { t } = useTranslation();
  const { isCollapsed, toggleSidebar } = useSidebarStore();
  const { isAuthenticated } = useAuthStore();

  const navigationItems: NavigationSection[] = [
    {
      title: t("nav.section.connection"),
      items: [
        { name: t("nav.item.terminal"), path: "/terminal", icon: Terminal },
        { name: t("nav.item.sessions"), path: "/sessions", icon: FolderOpen },
      ]
    },
    {
      title: t("nav.section.ai"),
      items: [
        { name: t("nav.item.aiChat"), path: "/ai-chat", icon: MessageSquare },
      ]
    },
    {
      title: t("nav.section.tools"),
      items: [
        { name: t("nav.item.sftp"), path: "/sftp", icon: HardDrive },
      ]
    },
    {
      title: t("nav.section.config"),
      items: [
        { name: t("nav.item.settings"), path: "/settings", icon: Settings },
      ]
    },
  ];

  return (
    <aside
      className={cn(
        "bg-card border-r border-border h-screen flex flex-col transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo Section */}
      <div className="h-16 border-b border-border flex items-center justify-between px-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {!isCollapsed && (
            <>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Terminal className="h-5 w-5 text-primary" />
              </div>
              <h1 className="font-bold text-lg whitespace-nowrap overflow-hidden">{t('app.name')}</h1>
            </>
          )}
        </div>

        {/* Toggle Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 flex-shrink-0"
          onClick={toggleSidebar}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div className={cn(
          "p-4 space-y-6 transition-all duration-300",
          isCollapsed && "px-2"
        )}>
          {navigationItems.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              {!isCollapsed && (
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
                  {section.title}
                </h3>
              )}
              <ul className={cn(
                "space-y-1",
                isCollapsed && "space-y-2"
              )}>
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center rounded-lg transition-all relative overflow-hidden",
                          isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )
                      }
                      title={isCollapsed ? item.name : undefined}
                    >
                      <item.icon className={cn(
                        "flex-shrink-0",
                        isCollapsed ? "h-5 w-5" : "h-4 w-4"
                      )} />
                      {!isCollapsed && (
                        <span className="text-sm font-medium whitespace-nowrap overflow-hidden">{item.name}</span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
              {sectionIndex < navigationItems.length - 1 && !isCollapsed && (
                <Separator className="my-4" />
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* Status Section */}
      <div className="p-4 border-t border-border">
        {isCollapsed ? (
          // 折叠状态：显示简单的状态
          <div className="text-xs text-muted-foreground text-center">
            {isAuthenticated ? "✓" : "🔌"}
          </div>
        ) : (
          // 展开状态：显示用户区域
          <UserArea />
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
