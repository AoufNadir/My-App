import React from 'react';
import { Button } from './Button';
import { useLanguage } from '../../contexts/LanguageContext';
export interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
    className?: string;
}
const AlertIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/>
  </svg>);
export const ErrorState: React.FC<ErrorStateProps> = ({ title, message, onRetry, className = '', }) => {
    const { t } = useLanguage();
    return (<div role="alert" className={`flex min-h-[160px] flex-col items-center justify-center px-4 py-8 text-center ${className}`}>
    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-danger-bg text-danger">
      <AlertIcon />
    </div>
    <h3 className="text-base font-semibold text-neutral-700">{title ?? t('common.errorTitle')}</h3>
    <p className="mt-1 text-sm text-neutral-500 max-w-sm">{message ?? t('common.errorBody')}</p>
    {onRetry && (<Button onClick={onRetry} variant="primary" size="sm" className="mt-4">
        {t('common.retry')}
      </Button>)}
  </div>);
};
