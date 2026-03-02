import React from 'react';
import { LanguageProvider } from './contexts/LanguageContext';
import AppContent from './AppContent';

export default function App() {
    return (
        <LanguageProvider>
            <AppContent />
        </LanguageProvider>
    );
}
