import React, { useState } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Label } from './ui/Label';
import { Alert, AlertDescription } from './ui/Alert';
import { UserIcon } from './icons/UserIcon';
import { GoogleAuthProvider, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, } from 'firebase/auth';
import { auth } from '../firebaseAuth';
// Minimal Eye Icons
const EyeIcon = ({ className }: {
    className?: string;
}) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-5 h-5"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.007 9.963 7.178.067.207.067.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.007-9.963-7.178Z"/>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
  </svg>);
const EyeSlashIcon = ({ className }: {
    className?: string;
}) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-5 h-5"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"/>
  </svg>);
// Google Icon
const GoogleIcon = () => (<svg className="me-3 h-5 w-5 text-primary" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path className="fill-success" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path className="fill-warning" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path className="fill-danger" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>);
export function Auth() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const isEmailValid = email.includes('@') && email.includes('.');
    const isFormValid = email && password && (isLogin || password === confirmPassword);
    const getFirebaseErrorMessage = (error: unknown): string => {
            if (typeof error === 'object' && error !== null && 'code' in error) {
                const code = (error as {
                    code: string;
                }).code;
                switch (code) {
                    case 'auth/invalid-email': return 'Email invalide.';
                    case 'auth/user-not-found': return 'Aucun compte trouvé avec cet email.';
                    case 'auth/wrong-password': return 'Mot de passe incorrect.';
                    case 'auth/email-already-in-use': return 'Cet email est déjà utilisé.';
                    case 'auth/weak-password': return 'Le mot de passe doit contenir au moins 6 caractères.';
                    // Google Sign-In specific errors
                    case 'auth/unauthorized-domain': return 'Ce domaine n\'est pas autorisé pour l\'authentification Google. Contactez l\'administrateur.';
                    case 'auth/operation-not-allowed': return 'L\'authentification Google n\'est pas activée dans Firebase Console.';
                    case 'auth/popup-blocked': return 'La fenêtre pop-up a été bloquée par le navigateur. Autorisez les pop-ups pour ce site.';
                    case 'auth/popup-closed-by-user': return 'La fenêtre d\'authentification a été fermée. Réessayez.';
                    case 'auth/cancelled-popup-request': return 'Une nouvelle demande d\'authentification a annulé la précédente.';
                    case 'auth/account-exists-with-different-credential': return 'Un compte existe déjà avec cet email via une autre méthode. Connectez-vous d\'abord avec cette méthode.';
                    default: return 'Une erreur est survenue. Veuillez réessayer.';
                }
            }
            return "Une erreur inconnue s'est produite.";
        };
    const handleAuthAction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid)
            return;
        setIsLoading(true);
        setError('');
        setMessage('');
        if (!isLogin && password !== confirmPassword) {
            setError("Les mots de passe ne correspondent pas.");
            setIsLoading(false);
            return;
        }
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            }
            else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
        }
        catch (err: unknown) {
            setError(getFirebaseErrorMessage(err));
        }
        finally {
            setIsLoading(false);
        }
    };
    const handlePasswordReset = async () => {
        if (!email) {
            setError("Veuillez entrer votre adresse e-mail.");
            return;
        }
        setIsLoading(true);
        setError('');
        setMessage('');
        try {
            await sendPasswordResetEmail(auth, email);
            setMessage("Un e-mail de réinitialisation a été envoyé.");
        }
        catch (err: unknown) {
            setError(getFirebaseErrorMessage(err));
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleGoogleSignIn = async () => {
            setIsLoading(true);
            setError('');
            setMessage('');
            try {
                const provider = new GoogleAuthProvider();
                await signInWithPopup(auth, provider);
            }
            catch (err: unknown) {
                console.error('Google Sign-In Error:', err);
                setError(getFirebaseErrorMessage(err));
            }
            finally {
                setIsLoading(false);
            }
        };
    const containerClass = "min-h-screen flex flex-col items-center justify-center p-6 bg-app-bg text-neutral-900";
    const cardClass = "w-full max-w-sm space-y-6";
    const inputClass = "bg-surface border border-border text-neutral-900 text-sm rounded-lg h-12 px-4 w-full placeholder-neutral-400 focus:ring-2 focus:ring-primary focus:border-primary transition-all";
    const labelClass = "mb-1.5 ms-1 block text-xs font-medium text-neutral-600";
    const primaryBtnClass = "w-full h-12 rounded-lg text-sm";
    const googleBtnClass = "w-full h-12 rounded-lg border border-border bg-surface text-neutral-700 font-medium text-sm flex items-center justify-center hover:bg-neutral-50 transition-all";
    return (<div className={containerClass}>
      <div className={cardClass}>

        {/* 1. Header: Logo & Title */}
        <div className="flex flex-col items-center space-y-4">
          {/* Logo Container - Optional glow effect */}
          <div className="relative group">
            <div className="absolute -inset-1 rounded-full bg-primary/20 blur opacity-75 transition duration-1000 group-hover:opacity-100"></div>
            <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface shadow-card">
              <img src="/logo.png" alt="Zumra" className="w-full h-full object-cover"/>
            </div>
          </div>
          <div className="text-center">
            <h1 className="mb-1 flex items-center justify-center gap-2 text-xl font-bold text-neutral-900">
              <UserIcon className="h-4 w-4 text-primary"/>
              {isLogin ? 'Se connecter' : 'Créer un compte'}
            </h1>
            {/* Subtitle removed on mobile to save space, maybe keep minimal text if needed */}
          </div>
        </div>

        {/* 2. Form Content */}
        <div className="w-full">
          {error && (<Alert className="mb-4 border border-danger/20 bg-danger-bg px-3 py-2 text-xs text-danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>)}
          {message && (<Alert className="mb-4 border border-primary/20 bg-info-bg px-3 py-2 text-xs text-primary">
              <AlertDescription>{message}</AlertDescription>
            </Alert>)}

          <form onSubmit={handleAuthAction} className="space-y-4">

            {/* Email */}
            <div>
              <Label htmlFor="email" className={labelClass}>Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ex: nom@email.com" required inputMode="email" autoComplete="email" enterKeyHint="next" className={inputClass}/>
            </div>

            {/* Password */}
            <div>
              <Label htmlFor="password" className={labelClass}>Mot de passe</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete={isLogin ? 'current-password' : 'new-password'} enterKeyHint={isLogin ? 'go' : 'next'} className={`${inputClass} pe-10`}/>
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute end-3 top-1/2 min-h-touch min-w-touch -translate-y-1/2 text-neutral-500 transition-colors hover:text-neutral-700">
                  {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Confirm (Register Only) */}
            {!isLogin && (<div>
                <Label htmlFor="confirm-password" className={labelClass}>Confirmer</Label>
                <Input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required autoComplete="new-password" enterKeyHint="go" className={inputClass}/>
              </div>)}

            {/* Primary Button */}
            <div className="pt-2">
              <Button type="submit" variant="primary" disabled={isLoading || !isFormValid} className={primaryBtnClass} loading={isLoading}>
                {isLoading ? 'Chargement...' : (isLogin ? 'Se connecter' : "S'inscrire")}
              </Button>
            </div>
          </form>

          {/* Google */}
          <div className="mt-4">
            <Button onClick={handleGoogleSignIn} disabled={isLoading} className={googleBtnClass}>
              <GoogleIcon />
              <span>Continuer avec Google</span>
            </Button>
          </div>

          {/* Links */}
          <div className="mt-6 flex flex-col items-center space-y-3 text-sm">

            <button onClick={() => { setIsLogin(!isLogin); setError(''); setMessage(''); }} className="min-h-touch text-neutral-500 transition-colors hover:text-primary">
              {isLogin ? "Nouveau ici ? " : "Déjà membre ? "}
              <span className="font-semibold text-primary">{isLogin ? 'Créer un compte' : 'Se connecter'}</span>
            </button>

            {isLogin && (<button onClick={handlePasswordReset} className="min-h-touch text-xs text-neutral-500 transition-colors hover:text-neutral-700">
                Mot de passe oublié ?
              </button>)}
          </div>
        </div>
      </div>
    </div>);
}
