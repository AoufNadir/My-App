import type { ReactNode } from 'react';
import { CARD_TONE_CLASS, type CardTone } from '../cards';
import { CurrencyAmount } from '../financial/CurrencyAmount';

type InvestorTxRowProps = {
    icon: ReactNode;
    tone: CardTone;
    label: string;
    date: string;
    time: string;
    notes?: string;
    /** Signed: what the operation added to (+) or took from (-) the investor's account. */
    amount: number;
};

/** One operation of an investor: type, date and time, notes, signed amount. */
export function InvestorTxRow({ icon, tone, label, date, time, notes, amount }: InvestorTxRowProps) {
    return (<div className="flex w-full items-center gap-3 bg-surface px-4 py-3">
      <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${CARD_TONE_CLASS[tone]}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-neutral-900">{label}</p>
        <p className="mt-0.5 text-xs text-neutral-500"><span dir="ltr">{date}</span> · <span dir="ltr">{time}</span></p>
        {notes && <p className="mt-0.5 truncate text-xs text-neutral-500">{notes}</p>}
      </div>
      <CurrencyAmount value={amount} currency="DZD" semantic="auto" size="md" showSign decimals={0} className="shrink-0 font-semibold"/>
    </div>);
}
