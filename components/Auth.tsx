
import React, { useState } from 'react';
import { Card, CardContent } from './ui/Card'; // Reduced imports
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Label } from './ui/Label';
import { Alert, AlertDescription } from './ui/Alert';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

// Minimal Eye Icons
const EyeIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-5 h-5"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.007 9.963 7.178.067.207.067.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.007-9.963-7.178Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

const EyeSlashIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-5 h-5"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
);

// Google Icon
const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

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
      const code = (error as { code: string }).code;
      switch (code) {
        case 'auth/invalid-email': return 'Email invalide.';
        case 'auth/user-not-found': return 'Aucun compte trouvé avec cet email.';
        case 'auth/wrong-password': return 'Mot de passe incorrect.';
        case 'auth/email-already-in-use': return 'Cet email est déjà utilisé.';
        case 'auth/weak-password': return 'Le mot de passe doit contenir au moins 6 caractères.';
        default: return 'Une erreur est survenue. Veuillez réessayer.';
      }
    }
    return "Une erreur inconnue s'est produite.";
  };

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    setIsLoading(true); setError(''); setMessage('');

    if (!isLogin && password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      setIsLoading(false); return;
    }

    try {
      if (isLogin) {
        await firebase.auth().signInWithEmailAndPassword(email, password);
      } else {
        await firebase.auth().createUserWithEmailAndPassword(email, password);
      }
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) { setError("Veuillez entrer votre adresse e-mail."); return; }
    setIsLoading(true); setError(''); setMessage('');
    try {
      await firebase.auth().sendPasswordResetEmail(email);
      setMessage("Un e-mail de réinitialisation a été envoyé.");
    } catch (err: unknown) { setError(getFirebaseErrorMessage(err)); } finally { setIsLoading(false); }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true); setError(''); setMessage('');
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await firebase.auth().signInWithPopup(provider);
    } catch (err: unknown) { setError(getFirebaseErrorMessage(err)); } finally { setIsLoading(false); }
  };

  // Modern Minimal Dark Theme Styles
  // Container: Dark Gradient, Full Screen, Flex Center
  // Card: Transparent or very subtle border, no shadow if unnecessary for "clean" look
  const containerClass = "min-h-screen flex flex-col items-center justify-center p-6 bg-[#0B1120] text-white"; // Deep dark background
  const cardClass = "w-full max-w-sm space-y-6"; // Removed Card bg to make it cleaner, just layout
  const inputClass = "bg-[#1E293B] border-none text-white text-sm rounded-xl h-12 px-4 w-full placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 transition-all";
  const labelClass = "block text-xs font-medium text-gray-400 mb-1.5 ml-1";
  const primaryBtnClass = `w-full h-12 rounded-xl font-bold text-sm text-white shadow-lg transition-all transform active:scale-95 ${isLoading || !isFormValid
    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'
    }`;
  const googleBtnClass = "w-full h-12 rounded-xl border border-gray-700 text-gray-300 font-medium text-sm flex items-center justify-center hover:bg-gray-800 transition-all";

  return (
    <div className={containerClass}>
      <div className={cardClass}>

        {/* 1. Header: Logo & Title */}
        <div className="flex flex-col items-center space-y-4">
          {/* Logo Container - Optional glow effect */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <div className="relative w-16 h-16 rounded-2xl bg-[#0F172A] border border-gray-800 flex items-center justify-center shadow-2xl">
              <img src="/logo.jpg" alt="Zumra" className="w-10 h-10 object-contain rounded-full" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
              {isLogin ? 'Se connecter' : 'Créer un compte'}
            </h1>
            {/* Subtitle removed on mobile to save space, maybe keep minimal text if needed */}
          </div>
        </div>

        {/* 2. Form Content */}
        <div className="w-full">
          {error && (
            <Alert className="mb-4 bg-red-500/10 border-red-500/20 text-red-400 text-xs py-2 px-3 rounded-lg border">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {message && (
            <Alert className="mb-4 bg-indigo-500/10 border-indigo-500/20 text-indigo-400 text-xs py-2 px-3 rounded-lg border">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleAuthAction} className="space-y-4">

            {/* Email */}
            <div>
              <Label htmlFor="email" className={labelClass}>Email</Label>
              <Input
                id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="ex: nom@email.com" required
                className={inputClass}
              />
            </div>

            {/* Password */}
            <div>
              <Label htmlFor="password" className={labelClass}>Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  className={`${inputClass} pr-10`}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Confirm (Register Only) */}
            {!isLogin && (
              <div>
                <Label htmlFor="confirm-password" className={labelClass}>Confirmer</Label>
                <Input
                  id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••" required
                  className={inputClass}
                />
              </div>
            )}

            {/* Primary Button */}
            <div className="pt-2">
              <Button type="submit" disabled={isLoading || !isFormValid} className={primaryBtnClass}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    Chargement...
                  </span>
                ) : (
                  isLogin ? 'Se connecter' : "S'inscrire"
                )}
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

            <button onClick={() => { setIsLogin(!isLogin); setError(''); setMessage(''); }} className="text-gray-400 hover:text-indigo-400 transition-colors">
              {isLogin ? "Nouveau ici ? " : "Déjà membre ? "}
              <span className="font-semibold text-indigo-400">{isLogin ? 'Créer un compte' : 'Se connecter'}</span>
            </button>

            {isLogin && (
              <button onClick={handlePasswordReset} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                Mot de passe oublié ?
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
