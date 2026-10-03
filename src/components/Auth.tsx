import React, { useState } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Label } from './ui/Label';
import { Alert, AlertDescription } from './ui/Alert';
import { GlobeIcon } from './icons/GlobeIcon';
import { useLanguage } from '../contexts/LanguageContext';
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
const GoogleIcon = () => (<svg className="h-5 w-5 shrink-0 text-primary" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path className="fill-success" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path className="fill-warning" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path className="fill-danger" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>);
export function Auth() {
    const { t, lang, setLang } = useLanguage();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    // Clés de traduction : le message suit la langue choisie, même après coup.
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const isFormValid = email && password && (isLogin || password === confirmPassword);
    const getFirebaseErrorMessage = (error: unknown): string => {
        if (typeof error === 'object' && error !== null && 'code' in error) {
            const code = (error as {
                code: string;
            }).code;
            switch (code) {
                case 'auth/invalid-email': return 'auth.errorInvalidEmail';
                case 'auth/user-not-found': return 'auth.errorUserNotFound';
                case 'auth/wrong-password': return 'auth.errorWrongPassword';
                case 'auth/email-already-in-use': return 'auth.errorEmailInUse';
                case 'auth/weak-password': return 'auth.errorWeakPassword';
                default: return 'auth.errorGeneric';
            }
        }
        return 'auth.errorUnknown';
    };
    const handleAuthAction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid)
            return;
        setIsLoading(true);
        setError('');
        setMessage('');
        if (!isLogin && password !== confirmPassword) {
            setError('auth.errorPasswordsMismatch');
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
            setError('auth.errorEnterEmail');
            return;
        }
        setIsLoading(true);
        setError('');
        setMessage('');
        try {
            await sendPasswordResetEmail(auth, email);
            setMessage('auth.resetSent');
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
            setError(getFirebaseErrorMessage(err));
        }
        finally {
            setIsLoading(false);
        }
    };
    const nextLang = lang === 'ar' ? 'fr' : 'ar';
    const inputClass = "bg-surface border border-border text-neutral-900 text-sm rounded-button h-12 px-4 w-full placeholder-neutral-400 focus:ring-2 focus:ring-primary focus:border-primary transition-all";
    const labelClass = "mb-1.5 block text-xs font-semibold text-neutral-600";
    const googleBtnClass = "w-full h-12 gap-3 rounded-button border border-border bg-surface text-neutral-700 font-semibold text-sm flex items-center justify-center hover:bg-surface-muted transition-all";
    return (<div className="flex min-h-screen flex-col bg-app-bg text-neutral-900">
      <div className="flex justify-end px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <button type="button" onClick={() => setLang(nextLang)} lang={nextLang} aria-label={t('auth.language')} className={`inline-flex min-h-touch items-center gap-2 rounded-full px-3 text-sm font-semibold text-neutral-600 transition-colors hover:bg-surface-muted ${nextLang === 'ar' ? 'font-arabic' : 'font-latin'}`}>
          <GlobeIcon aria-hidden="true" className="h-4 w-4"/>
          {nextLang === 'ar' ? 'العربية' : 'Français'}
        </button>
      </div>

      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-[max(env(safe-area-inset-bottom),2rem)]">
        <div className="w-full max-w-sm space-y-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-card border border-border bg-surface shadow-card">
              <img src="/logo.png" alt="ProDigital" className="h-full w-full object-cover"/>
            </div>
            <h1 className="text-xl font-bold text-neutral-900">
              {isLogin ? t('auth.signIn') : t('auth.createAccount')}
            </h1>
          </div>

          <section className="space-y-4 rounded-card border border-border bg-surface p-4 shadow-card">
            {error && (<Alert className="border border-danger/20 bg-danger-bg px-3 py-2 text-xs text-danger">
                <AlertDescription>{t(error)}</AlertDescription>
              </Alert>)}
            {message && (<Alert className="border border-primary/20 bg-info-bg px-3 py-2 text-xs text-primary">
                <AlertDescription>{t(message)}</AlertDescription>
              </Alert>)}

            <form onSubmit={handleAuthAction} className="space-y-4">
              <div>
                <Label htmlFor="email" className={labelClass}>{t('auth.email')}</Label>
                <Input id="email" type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} required inputMode="email" autoComplete="email" enterKeyHint="next" className={`${inputClass} rtl:text-right`}/>
              </div>

              <div>
                <Label htmlFor="password" className={labelClass}>{t('auth.password')}</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} dir="ltr" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete={isLogin ? 'current-password' : 'new-password'} enterKeyHint={isLogin ? 'go' : 'next'} className={`${inputClass} pe-12 rtl:text-right`}/>
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')} aria-pressed={showPassword} className="absolute end-0.5 top-1/2 flex min-h-touch min-w-touch -translate-y-1/2 items-center justify-center rounded-full text-neutral-500 transition-colors hover:text-neutral-700">
                    {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {!isLogin && (<div>
                  <Label htmlFor="confirm-password" className={labelClass}>{t('auth.confirmPassword')}</Label>
                  <Input id="confirm-password" type="password" dir="ltr" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required autoComplete="new-password" enterKeyHint="go" className={`${inputClass} rtl:text-right`}/>
                </div>)}

              <Button type="submit" variant="primary" disabled={isLoading || !isFormValid} className="h-12 w-full rounded-button text-sm" loading={isLoading}>
                {isLoading ? t('auth.loading') : (isLogin ? t('auth.signIn') : t('auth.signUp'))}
              </Button>
            </form>

            <div className="flex items-center gap-3 text-xs font-semibold text-neutral-400" aria-hidden="true">
              <span className="h-px flex-1 bg-border"/>
              {t('auth.or')}
              <span className="h-px flex-1 bg-border"/>
            </div>

            <Button onClick={handleGoogleSignIn} disabled={isLoading} className={googleBtnClass}>
              <GoogleIcon />
              <span>{t('auth.google')}</span>
            </Button>
          </section>

          <div className="flex flex-col items-center gap-1 text-sm">
            <button onClick={() => { setIsLogin(!isLogin); setError(''); setMessage(''); }} className="min-h-touch px-2 text-neutral-500 transition-colors hover:text-primary">
              {isLogin ? t('auth.newHere') : t('auth.alreadyMember')}{' '}
              <span className="font-semibold text-primary">{isLogin ? t('auth.createAccount') : t('auth.signIn')}</span>
            </button>

            {isLogin && (<button onClick={handlePasswordReset} className="min-h-touch px-2 text-xs font-semibold text-neutral-500 transition-colors hover:text-neutral-700">
                {t('auth.forgotPassword')}
              </button>)}
          </div>
        </div>
      </main>
    </div>);
}
