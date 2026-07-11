import { useState, useEffect } from 'react';
import type { FirestoreDocumentReference } from '../firebase';
export function useSettings(userDocRef: FirestoreDocumentReference) {
    const [managerFeePercentage, setManagerFeePercentage] = useState(() => localStorage.getItem('managerFeePercentage') || "20");
    const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
    useEffect(() => {
        localStorage.setItem('managerFeePercentage', managerFeePercentage);
    }, [managerFeePercentage]);
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const doc = await userDocRef.get();
                if (doc.exists) {
                    const data = doc.data();
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
    return {
        managerFeePercentage, setManagerFeePercentage,
        isSettingsLoaded
    };
}
