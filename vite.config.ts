import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const loadSafeEnv = (mode: string) => {
  try {
    return loadEnv(mode, '.', '');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[vite] Unable to read env files for mode "${mode}". Falling back to process.env only. ${reason}`);
    return { ...process.env } as Record<string, string>;
  }
};

export default defineConfig(({ mode }) => {
  const env = loadSafeEnv(mode);
  const geminiApiKey = env.GEMINI_API_KEY || env.API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY || '';

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    build: {
      target: 'es2020',
      sourcemap: false,
      cssCodeSplit: true,
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (!id.includes('node_modules')) {
              if (id.includes('/utils/pdfReports')) return 'pdfReports';
              if (id.includes('/utils/pamLedger')) return 'pamLedger';
              return undefined;
            }
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'react';
            if (id.includes('firebase/auth')) return 'firebaseAuth';
            if (id.includes('firebase/firestore')) return 'firebaseFirestore';
            if (id.includes('firebase')) return 'firebaseCore';
            if (id.includes('framer-motion') || id.includes('/motion-dom/') || id.includes('/motion-utils/')) return 'motion';
            if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory-vendor')) return 'charts';
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'pdf';
            if (id.includes('xlsx') || id.includes('papaparse')) return 'spreadsheet';
            return 'vendor';
          }
        }
      }
    },
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.API_KEY': JSON.stringify(geminiApiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    }
  };
});
