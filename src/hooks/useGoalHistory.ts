import { useEffect, useState } from 'react';

type PlansRef = { collection: (name: string) => { onSnapshot: (next: (snap: { forEach: (fn: (doc: { id: string; data: () => Record<string, unknown> }) => void) => void }) => void, options?: unknown, onError?: (e: Error) => void) => () => void } };

// P6: the goal of each month as the owner saved it (pricing_plans/<YYYY-MM>). Read only.
export function useGoalHistory(userDocRef: PlansRef | null | undefined): Record<string, number> {
    const [goals, setGoals] = useState<Record<string, number>>({});
    useEffect(() => {
        if (!userDocRef) return undefined;
        return userDocRef.collection('pricing_plans').onSnapshot((snap) => {
            const next: Record<string, number> = {};
            snap.forEach((doc) => { const goal = Number(doc.data()?.monthlyGoal); if (/^\d{4}-\d{2}$/.test(doc.id) && goal > 0) next[doc.id] = goal; });
            setGoals((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
        }, undefined, (error) => console.error('Error loading goal history:', error));
    }, [userDocRef]);
    return goals;
}
