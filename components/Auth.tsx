
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Label } from './ui/Label';
import { Alert, AlertDescription } from './ui/Alert';
// FIX: Import Firebase to correctly use its services instead of relying on a global 'any' type.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

export function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const getFirebaseErrorMessage = (error: unknown): string => {
      if (typeof error === 'object' && error !== null && 'message' in error) {
          return (error as { message: string }).message;
      }
      return "Une erreur inconnue s'est produite.";
  }

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
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
        await firebase.auth().signInWithEmailAndPassword(email, password);
        // onAuthStateChanged in App.tsx will handle the redirect
      } else {
        await firebase.auth().createUserWithEmailAndPassword(email, password);
        // onAuthStateChanged in App.tsx will handle the redirect
      }
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePasswordReset = async () => {
    if (!email) {
      setError("Veuillez entrer votre adresse e-mail pour réinitialiser le mot de passe.");
      return;
    }
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      await firebase.auth().sendPasswordResetEmail(email);
      setMessage("Un e-mail de réinitialisation de mot de passe a été envoyé. Veuillez vérifier votre boîte de réception.");
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await firebase.auth().signInWithPopup(provider);
    } catch (err: unknown) {
        setError(getFirebaseErrorMessage(err));
    } finally {
        setIsLoading(false);
    }
  };

  const isDark = document.documentElement.classList.contains('dark');
  const bgApp = isDark ? 'from-[#0B1120] via-[#0F172A] to-[#1E293B] text-gray-100' : 'from-[#F8FAFC] via-[#F1F5F9] to-[#E2E8F0] text-gray-900';
  const cardBase = isDark ? 'bg-[#111827]/90 border-[#1f2937] text-white' : 'bg-white/90 border-[#E5E7EB] text-gray-900';
  const fieldBase = isDark ? 'bg-[#0F172A] text-white border border-[#334155]' : 'bg-white text-gray-900 border border-[#CBD5E1]';
  const subtleText = isDark ? 'text-[#9CA3AF]' : 'text-[#475569]';

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgApp} p-6 flex flex-col items-center justify-center`}>
      <Card className={`w-full max-w-md ${cardBase} border shadow-xl rounded-2xl`}>
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">{isLogin ? 'Se connecter' : "S'inscrire"}</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <Alert className="mb-4 bg-red-500/10 border-red-500/50 text-red-400"><AlertDescription>{error}</AlertDescription></Alert>}
          {message && <Alert className="mb-4 bg-green-500/10 border-green-500/50 text-green-400"><AlertDescription>{message}</AlertDescription></Alert>}
          <form onSubmit={handleAuthAction} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className={fieldBase} />
            </div>
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className={fieldBase} />
            </div>
            {!isLogin && (
              <div>
                <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                <Input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className={fieldBase} />
              </div>
            )}
            <Button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl">
              {isLoading ? 'Chargement...' : (isLogin ? 'Se connecter' : "S'inscrire")}
            </Button>
          </form>
          <div className="mt-4 text-center">
             <Button onClick={handleGoogleSignIn} disabled={isLoading} className={`w-full font-bold py-3 rounded-xl mb-4 ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}>
                Continuer avec Google
             </Button>
            <button onClick={() => { setIsLogin(!isLogin); setError(''); setMessage(''); }} className={`text-sm ${subtleText} hover:underline`}>
              {isLogin ? "Vous n'avez pas de compte ? S'inscrire" : 'Vous avez déjà un compte ? Se connecter'}
            </button>
             {isLogin && (
              <button onClick={handlePasswordReset} className={`block mx-auto mt-2 text-sm ${subtleText} hover:underline`}>
                Mot de passe oublié ?
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
