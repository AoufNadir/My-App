import { connectAuthEmulator, getAuth, type User } from 'firebase/auth';
import { app } from './firebaseApp';
export const auth = getAuth(app);
if ((import.meta as any).env.VITE_E2E_EMULATOR === '1') connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
export type AppUser = User;
