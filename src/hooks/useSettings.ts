import { useState, useEffect } from 'react';
import type { FirestoreDocumentReference } from '../firebase';
export function useSettings(userDocRef: FirestoreDocumentReference) {
    const [suggestedProfitMargin, setSuggestedProfitMargin] = useState(() => localStorage.getItem('suggestedProfitMargin') || '2');
    const [suggestedSellingPrice, setSuggestedSellingPrice] = useState(() => localStorage.getItem('suggestedSellingPrice') || '');
    const [suggestedUsdtEurSellPrice, setSuggestedUsdtEurSellPrice] = useState(() => localStorage.getItem('suggestedUsdtEurSellPrice') || '');
    const [suggestedSellingPriceEur, setSuggestedSellingPriceEur] = useState(() => localStorage.getItem('suggestedSellingPriceEur') || '');
    const [managerFeePercentage, setManagerFeePercentage] = useState(() => localStorage.getItem('managerFeePercentage') || "20");
    const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
    useEffect(() => {
        localStorage.setItem('suggestedProfitMargin', suggestedProfitMargin);
    }, [suggestedProfitMargin]);
    useEffect(() => {
        localStorage.setItem('suggestedSellingPrice', suggestedSellingPrice);
    }, [suggestedSellingPrice]);
    useEffect(() => {
        localStorage.setItem('suggestedUsdtEurSellPrice', suggestedUsdtEurSellPrice);
    }, [suggestedUsdtEurSellPrice]);
    useEffect(() => {
        localStorage.setItem('suggestedSellingPriceEur', suggestedSellingPriceEur);
    }, [suggestedSellingPriceEur]);
    useEffect(() => {
        localStorage.setItem('managerFeePercentage', managerFeePercentage);
    }, [managerFeePercentage]);
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const doc = await userDocRef.get();
                if (doc.exists) {
                    const data = doc.data();
                    if (data?.suggestedProfitMargin !== undefined) {
                        setSuggestedProfitMargin(parseFloat(data.suggestedProfitMargin).toFixed(2));
                    }
                    if (data?.suggestedSellingPrice !== undefined) {
                        setSuggestedSellingPrice(parseFloat(data.suggestedSellingPrice).toFixed(2));
                    }
                    if (data?.suggestedUsdtEurSellPrice !== undefined) {
                        setSuggestedUsdtEurSellPrice(parseFloat(data.suggestedUsdtEurSellPrice).toFixed(4));
                    }
                    if (data?.suggestedSellingPriceEur !== undefined) {
                        setSuggestedSellingPriceEur(parseFloat(data.suggestedSellingPriceEur).toFixed(2));
                    }
                    if (data?.managerFeePercentage !== undefined) {
                        setManagerFeePercentage(data.managerFeePercentage.toString());
                    }
                }
            }
            catch (e) {
                console.error('Error loading settings:', e);
            }
            finally {
                setIsSettingsLoaded(true);
            }
        };
        loadSettings();
    }, [userDocRef]);
    useEffect(() => {
        if (!isSettingsLoaded)
            return;
        const timer = setTimeout(async () => {
            try {
                const val = parseFloat(managerFeePercentage);
                if (!isNaN(val)) {
                    await userDocRef.update({ managerFeePercentage: val });
                }
            }
            catch (e) {
                console.error('Error saving manager fee:', e);
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [managerFeePercentage, userDocRef, isSettingsLoaded]);
    const [theme, setThemeState] = useState<string>('light');
    const setTheme = () => setThemeState('light');
    useEffect(() => {
        localStorage.setItem('theme', 'light');
        document.documentElement.classList.remove('dark');
        if (theme !== 'light')
            setThemeState('light');
    }, [theme]);
    return {
        suggestedProfitMargin, setSuggestedProfitMargin,
        suggestedSellingPrice, setSuggestedSellingPrice,
        suggestedUsdtEurSellPrice, setSuggestedUsdtEurSellPrice,
        suggestedSellingPriceEur, setSuggestedSellingPriceEur,
        managerFeePercentage, setManagerFeePercentage,
        isSettingsLoaded,
        theme, setTheme
    };
}
