import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 部署配置
  // 仓库名是 'ssh-terminal'，使用 '/ssh-terminal/'
  base: '/ssh-terminal/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
