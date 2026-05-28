import { getAuth, type User } from 'firebase/auth';
import { app } from './firebaseApp';
export const auth = getAuth(app);
export type AppUser = User;
