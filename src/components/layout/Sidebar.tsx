import { NavLink } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import {
  Terminal,
  FolderOpen,
  HardDrive,
  Settings,
  LucideIcon
} from "lucide-react";

interface NavigationItem {
  name: string;
  path: string;
  icon: LucideIcon;
}

interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

const navigationItems: NavigationSection[] = [
  {
    title: "连接",
    items: [
      { name: "终端", path: "/terminal", icon: Terminal },
      { name: "会话管理", path: "/sessions", icon: FolderOpen },
    ]
  },
  {
    title: "工具",
    items: [
      { name: "文件管理器", path: "/sftp", icon: HardDrive },
    ]
  },
  {
    title: "配置",
    items: [
      { name: "设置", path: "/settings", icon: Settings },
    ]
  },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-card border-r border-border h-screen flex flex-col">
      {/* Logo Section */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Terminal className="h-5 w-5 text-primary" />
          </div>
          <h1 className="font-bold text-lg">SSH Terminal</h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto custom-scrollbar">
        {navigationItems.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
              {section.title}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`
                    }
                                     >
                     <item.icon className="w-4 h-4" />
                     {item.name}
                   </NavLink>
                </li>
              ))}
            </ul>
            {sectionIndex < navigationItems.length - 1 && (
              <Separator className="my-4" />
            )}
          </div>
        ))}
      </nav>

             {/* Status Section */}
       <div className="p-4 border-t border-border">
         <div className="text-xs text-muted-foreground text-center">
           SSH Ready
         </div>
       </div>
    </aside>
  );
}
