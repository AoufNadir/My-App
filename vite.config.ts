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
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            firebaseAuth: ['firebase/app', 'firebase/auth'],
            firebaseFirestore: ['firebase/firestore'],
            motion: ['framer-motion'],
            charts: ['recharts']
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
