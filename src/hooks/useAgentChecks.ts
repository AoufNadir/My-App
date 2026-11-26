import { useCallback, useEffect, useState } from 'react';

// V27-1: what was already collected from an intermediary: the ids of his deposits marked collected, and the day his
// follow-up starts (older lines are not listed). agent_checks/{agentId} — no money, no balance: the money moves with
// the ordinary collect and transfers.
type DocRef = {
    collection: (name: string) => { doc: (id: string) => {
        onSnapshot: (next: (snap: { exists: boolean; data: () => Record<string, unknown> | undefined }) => void, options?: object, onError?: (e: Error) => void) => () => void;
        set: (data: Record<string, unknown>, options: { merge: boolean }) => Promise<unknown>;
    } };
};
export type AgentCheckState = { loaded: boolean; collected: Set<string>; since: number };

export function useAgentChecks(userDocRef: DocRef | null | undefined, agentId: string | null | undefined) {
    const [state, setState] = useState<AgentCheckState>({ loaded: false, collected: new Set(), since: 0 });
    useEffect(() => {
        if (!userDocRef || !agentId) return undefined;
        return userDocRef.collection('agent_checks').doc(agentId).onSnapshot((snap) => {
            const data = snap.exists ? snap.data() ?? {} : {};
            const ids = Array.isArray(data.collectedIds) ? (data.collectedIds as unknown[]).filter((x): x is string => typeof x === 'string') : [];
            setState({ loaded: true, collected: new Set(ids), since: Number(data.since) || 0 });
        }, {}, (e) => { console.error('agent_checks', e); setState((s) => ({ ...s, loaded: true })); });
    }, [userDocRef, agentId]);
    const markCollected = useCallback(async (ids: string[], extra: Record<string, unknown> = {}) => {
        if (!userDocRef || !agentId) return;
        await userDocRef.collection('agent_checks').doc(agentId).set({ collectedIds: [...new Set([...state.collected, ...ids])], ...extra }, { merge: true });
    }, [userDocRef, agentId, state.collected]);
    const startFrom = useCallback(async (since: number) => {
        if (!userDocRef || !agentId) return;
        await userDocRef.collection('agent_checks').doc(agentId).set({ since }, { merge: true });
    }, [userDocRef, agentId]);
    return { ...state, markCollected, startFrom };
}
