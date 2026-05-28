import React from 'react';
import { ThemeProvider } from './providers/ThemeProvider';
import { LanguageProvider } from './contexts/LanguageContext';
import AppContent from './AppContent';
export default function App() {
    return (
        <ThemeProvider>
            <LanguageProvider>
                <AppContent />
            </LanguageProvider>
        </ThemeProvider>
    );
}
