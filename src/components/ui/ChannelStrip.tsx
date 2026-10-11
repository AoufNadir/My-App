import type { ReactNode } from 'react';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { BanknotesIcon } from '../icons/BanknotesIcon';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { CHANNEL_TONE, channelSentenceKey, type ChannelKind, type ChannelSummary } from '../../utils/channelSummary';
import type { UsualChannel } from '../../utils/usualChannel';

type TranslateFn = (key: string) => unknown;

export type ChannelStripProps = {
    /** What the operation will record; null (no amount yet) shows nothing. */
    summary: ChannelSummary | null;
    operation: 'sell' | 'buy' | 'settlement';
    /** The amount, already formatted (« 150 000 DZD »). */
    amountLabel: string;
    /** The client whose account carries the amount (credit, or an amount taken by another client). */
    clientName?: string;
    /** The usual channel of the client, when the one chosen here is the other one. */
    usualDiffers?: UsualChannel | null;
    t: TranslateFn;
};

const KIND_STYLE: Record<ChannelKind, { box: string; icon: ReactNode }> = {
    cash: { box: 'border-financial-profit/30 bg-financial-profit-bg text-financial-profit', icon: <WalletIcon aria-hidden="true" className="h-5 w-5 shrink-0"/> },
    baridi: { box: 'border-financial-asset/30 bg-financial-asset-bg text-financial-asset', icon: <BanknotesIcon aria-hidden="true" className="h-5 w-5 shrink-0"/> },
    credit: { box: 'border-financial-debt/30 bg-financial-debt-bg text-financial-debt', icon: <CreditCardIcon aria-hidden="true" className="h-5 w-5 shrink-0"/> },
    client: { box: 'border-border bg-surface-muted text-neutral-700', icon: <UsersIcon aria-hidden="true" className="h-5 w-5 shrink-0"/> },
};

const fill = (text: string, values: Record<string, string>) =>
    Object.entries(values).reduce((out, [name, value]) => out.split(`{${name}}`).join(value), text);
/** Keeps an amount or a name whole inside an Arabic sentence (« 10 000,00 DZD » is not read from the right). */
const isolate = (text: string) => `\u2066${text}\u2069`;

/**
 * V5-4: one coloured line above the Confirm button that says where the money will be recorded,
 * in the colour of the channel (cash green, BaridiMob blue, credit orange). It reads the choice
 * the window already holds and changes nothing; a wrong channel is the cheapest mistake to see here.
 */
export function ChannelStrip({ summary, operation, amountLabel, clientName, usualDiffers, t }: ChannelStripProps) {
    if (!summary)
        return null;
    const style = KIND_STYLE[summary.kind];
    const sentence = fill(String(t(channelSentenceKey(summary, operation))), {
        amount: isolate(amountLabel),
        client: isolate(clientName || String(t('channelStrip.theClient'))),
    });
    return (<div data-channel={summary.kind} data-channel-tone={CHANNEL_TONE[summary.kind]} className="space-y-1.5">
      <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${style.box}`}>
        <span className="mt-px">{style.icon}</span>
        <p className="min-w-0 text-xs font-bold leading-snug">
          <span className="block text-[11px] font-semibold uppercase tracking-wide opacity-80">{t('channelStrip.title') as string}</span>
          <span dir="auto">{sentence}</span>
        </p>
      </div>
      {usualDiffers && (<p role="note" className="flex items-start gap-1.5 text-xs font-semibold leading-snug text-financial-debt">
          <AlertTriangleIcon aria-hidden="true" className="mt-px h-4 w-4 shrink-0"/>
          <span className="min-w-0">{t(usualDiffers === 'baridi' ? 'channelStrip.usualBaridi' : 'channelStrip.usualCash') as string}</span>
        </p>)}
    </div>);
}
ChannelStrip.displayName = 'ChannelStrip';
