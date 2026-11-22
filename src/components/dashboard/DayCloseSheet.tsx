import { BottomSheet } from '../ui/BottomSheet';
import { useLanguage } from '../../contexts/LanguageContext';
import type { DayClose } from '../../utils/dayClose';

// V23-1 (owner): « Clôture du jour » — today in one screen, then the count. Read only: the button opens the inventory.
const W = {
    fr: {
        title: 'Clôture du jour', today: 'Aujourd’hui', sales: 'Ventes', buys: 'Achats', profit: 'Bénéfice du jour', total: 'Montant des ventes',
        moves: 'Mouvements du jour', in: 'entrées', out: 'sorties', none: 'Aucune opération aujourd’hui.',
        expected: 'Ce que vous devez avoir maintenant', count: 'Compter maintenant (inventaire)', close: 'Fermer',
    },
    ar: {
        title: 'إقفال اليوم', today: 'اليوم', sales: 'المبيعات', buys: 'المشتريات', profit: 'ربح اليوم', total: 'مبلغ المبيعات',
        moves: 'حركات اليوم', in: 'دخل', out: 'خرج', none: 'لا عملية اليوم.',
        expected: 'ما يجب أن يكون عندك الآن', count: 'اعدد الآن (الجرد)', close: 'إغلاق',
    },
};
const fmt = (v: number, max = 2) => v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: max });

export type DayCloseWallet = { id: string; name: string; amount: number; unit: string };

export function DayCloseSheet({ isOpen, onClose, day, wallets, accountName, onCount }: {
    isOpen: boolean;
    onClose: () => void;
    day: DayClose;
    wallets: DayCloseWallet[];
    accountName: (id: string) => string;
    onCount: () => void;
}) {
    const { lang } = useLanguage();
    const w = W[lang];
    const nothing = day.sales === 0 && day.buys === 0 && Object.keys(day.moves).length === 0;
    const row = 'flex items-baseline justify-between gap-3 py-1.5 text-sm';
    const qty = (m: Record<string, number>) => Object.entries(m).map(([c, q]) => `${fmt(q)} ${c}`).join(' · ');
    return (<BottomSheet isOpen={isOpen} onClose={onClose} title={w.title}>
      <div data-testid="day-close" className="flex flex-col gap-3 px-5 pb-5 pt-2">
        <section className="rounded-card border border-border bg-surface p-3">
          <h3 className="text-xs font-bold text-neutral-500">{w.today}</h3>
          {nothing ? <p className="py-2 text-sm text-neutral-600">{w.none}</p> : (<>
            <div className={row}><span className="text-neutral-700">{w.sales} · <bdi dir="ltr">{day.sales}</bdi></span><bdi dir="ltr" className="font-semibold text-neutral-900">{qty(day.soldByCurrency) || '—'}</bdi></div>
            <div className={row}><span className="text-neutral-700">{w.total}</span><bdi dir="ltr" className="font-semibold text-neutral-900">{fmt(day.salesTotal, 0)} DZD</bdi></div>
            <div className={row}><span className="text-neutral-700">{w.buys} · <bdi dir="ltr">{day.buys}</bdi></span><bdi dir="ltr" className="font-semibold text-neutral-900">{qty(day.boughtByCurrency) || '—'}</bdi></div>
            <div className={`${row} border-t border-border pt-2`}><span className="font-bold text-neutral-900">{w.profit}</span><bdi dir="ltr" className={`text-lg font-black ${day.profit < 0 ? 'text-financial-loss' : 'text-financial-profit'}`}>{fmt(day.profit, 0)} DZD</bdi></div>
          </>)}
        </section>
        {Object.keys(day.moves).length > 0 && (<section className="rounded-card border border-border bg-surface p-3">
            <h3 className="text-xs font-bold text-neutral-500">{w.moves}</h3>
            {Object.entries(day.moves).map(([id, m]) => (<div key={id} className={row}>
                <span className="text-neutral-700">{accountName(id)}</span>
                <span className="text-end text-xs"><bdi dir="ltr" className="font-semibold text-financial-profit">+{fmt(m.in, 0)}</bdi> {w.in} · <bdi dir="ltr" className="font-semibold text-financial-loss">−{fmt(m.out, 0)}</bdi> {w.out}</span>
              </div>))}
          </section>)}
        <section className="rounded-card border border-border bg-surface p-3">
          <h3 className="text-xs font-bold text-neutral-500">{w.expected}</h3>
          {wallets.map((wl) => (<div key={wl.id} className={row}><span className="text-neutral-700">{wl.name}</span><bdi dir="ltr" className="font-bold text-neutral-900">{fmt(wl.amount, wl.unit === 'DZD' ? 0 : 2)} {wl.unit}</bdi></div>))}
        </section>
        <button type="button" onClick={onCount} className="h-12 rounded-button bg-primary text-sm font-bold text-white">{w.count}</button>
        <button type="button" onClick={onClose} className="h-11 rounded-button border border-border bg-surface text-sm font-semibold text-neutral-700">{w.close}</button>
      </div>
    </BottomSheet>);
}
