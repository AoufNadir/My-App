import { useCallback, useMemo, useState } from 'react';
import type { InvestorTransaction } from '../types';
import { toDateInputValue } from '../utils/dateInput';
import {
    isInvestorTermSnoozed,
    openInvestorTerms,
    readTermSnoozes,
    snoozeInvestorTerm,
    writeTermSnoozes,
    type InvestorTerm,
    type InvestorTermInvestor,
    type InvestorTermSnoozes,
} from '../utils/investorTerms';

const NO_TERMS: InvestorTerm[] = [];

/**
 * Open quarterly terms of the investors (utils/investorTerms). `terms` holds every open term, for
 * the investor list and page; `reminders` leaves out the ones put off with « remind me in 3 days »,
 * for the home alerts and the phone notification. Until `ready` (both the investors and their
 * history received), nothing is open: an empty history would leave every term unsettled.
 */
export function useInvestorTerms(investors: ReadonlyArray<InvestorTermInvestor>, transactions: ReadonlyArray<InvestorTransaction>, ready: boolean) {
    const [snoozes, setSnoozes] = useState<InvestorTermSnoozes>(() => readTermSnoozes());
    // `today` is a dependency so the terms are worked out again when the day changes, not only
    // when the data does.
    const today = toDateInputValue(new Date());
    const terms = useMemo(
        () => (ready ? openInvestorTerms(investors, transactions, Date.now()) : NO_TERMS),
        [ready, investors, transactions, today]
    );
    const reminders = useMemo(
        () => {
            const nowTs = Date.now();
            const shown = terms.filter((term) => !isInvestorTermSnoozed(term, snoozes, nowTs));
            return shown.length === terms.length ? terms : shown;
        },
        [terms, snoozes, today]
    );
    const byInvestorId = useMemo(() => new Map(terms.map((term) => [term.investorId, term] as const)), [terms]);
    const snooze = useCallback((term: Pick<InvestorTerm, 'investorId' | 'termKey'>) => {
        setSnoozes((current) => {
            const next = snoozeInvestorTerm(current, term, Date.now());
            writeTermSnoozes(next);
            return next;
        });
    }, []);
    return { terms, reminders, byInvestorId, snooze };
}
