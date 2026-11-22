import { initializeApp } from 'firebase/app';
/** V24-3: true only in a build made for the browser tests (never in the published build: no .env at deploy). */
export const E2E_EMULATOR = (import.meta as any).env.VITE_E2E_EMULATOR === '1';
const firebaseConfig = {
    apiKey: "AIzaSyBQuc1tL9mt7aG4bMWTbixw_c3aw_tgINQ",
    authDomain: "proodigital-7ec70.firebaseapp.com",
    // V24-3: the browser tests build with VITE_E2E_EMULATOR=1 and talk to a local emulator only (fake data).
    projectId: (import.meta as any).env.VITE_E2E_EMULATOR === '1' ? "demo-prodigital" : "proodigital-7ec70",
    storageBucket: "proodigital-7ec70.firebasestorage.app",
    messagingSenderId: "581545185473",
    appId: "1:581545185473:web:6df6b106d9ce80a89ec440"
};
export const app = initializeApp(firebaseConfig);
