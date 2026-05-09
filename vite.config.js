import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'lucide-react',
    ],
    exclude: [
      'xlsx',
      'jspdf',
      'html2canvas',
      'chart.js',
      'react-chartjs-2',
    ],
  },
  build: {
    // Split heavy libraries into separate chunks
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
          'vendor-xlsx': ['xlsx'],
        },
      },
    },
  },
  server: {
    // Warm up frequently used files
    warmup: {
      clientFiles: [
        './src/App.jsx',
        './src/components/dashboard/DashboardLayout.jsx',
        './src/components/dashboard/Sidebar.jsx',
        './src/components/dashboard/Header.jsx',
        './src/context/AuthContext.jsx',
        './src/config/appConfig.js',
      ],
    },
  },
})