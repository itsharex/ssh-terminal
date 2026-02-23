import "@/i18n/config";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeGlobalKeyHandler } from "@/lib/globalKeyHandler";

// 初始化全局快捷键处理器
initializeGlobalKeyHandler();

// 生产环境禁用右键菜单（Tauri 层已全局禁用，这里作为前端层控制）
// 开发环境：允许右键（方便调试）
// 生产环境：阻止右键（防止用户查看/复制）
if (!import.meta.env.DEV) {
  window.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);
