import { useMemo, useState, type ReactNode } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { SearchableSelect } from '../ui/SearchableSelect';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { CalendarIcon } from '../icons/CalendarIcon';
import { DownloadCloudIcon } from '../icons/DownloadCloudIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { CARD_TONE_CLASS, type CardTone } from '../cards';
import { useLanguage } from '../../contexts/LanguageContext';
import { selectableClients } from '../../utils/clientRegistry';
import type { ClientDzd } from '../../types';

type AnalyticsExportSheetProps = {
    isOpen: boolean;
    onClose: () => void;
    /** Month and year chosen on the page, and the profit shown for them. */
    monthLabel: string;
    year: number;
    realizedProfit: number;
    monthlyHasData: boolean;
    onExportMonthly: () => void;
    reportClient: string;
    reportMonth: number;
    reportYear: number;
    reportMonths: (year: number) => string[];
    reportYears: number[];
    clientsDzd: ClientDzd[];
    getClientFullName: (client: ClientDzd) => string;
    onExportClient: (clientId: string, month: number, year: number) => void;
};

function ExportBlock({ icon, tone, title, subtitle, children }: { icon: ReactNode; tone: CardTone; title: string; subtitle?: ReactNode; children: ReactNode }) {
    return (<section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${CARD_TONE_CLASS[tone]}`}>{icon}</span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>);
}

/** The PDF reports of Analyse: the month on screen, or one client's month. */
export function AnalyticsExportSheet({ isOpen, onClose, monthLabel, year, realizedProfit, monthlyHasData, onExportMonthly, reportClient, reportMonth, reportYear, reportMonths, reportYears, clientsDzd, getClientFullName, onExportClient }: AnalyticsExportSheetProps) {
    const { t } = useLanguage();
    const [clientId, setClientId] = useState(reportClient);
    const [clientMonth, setClientMonth] = useState(reportMonth);
    const [clientYear, setClientYear] = useState(reportYear);
    const sortedClients = useMemo(() => selectableClients(clientsDzd, [clientId]).sort((a, b) => getClientFullName(a).localeCompare(getClientFullName(b), 'fr')), [clientsDzd, clientId, getClientFullName]);

    return (<BottomSheet isOpen={isOpen} onClose={onClose} title={t('portfolio.exportReportTitle') as string}>
      <div className="flex flex-col gap-3 p-4 sm:px-5">
        <ExportBlock icon={<CalendarIcon className="h-5 w-5"/>} tone="primary" title={t('reports.monthlyReport') as string} subtitle={(<>
            {monthLabel} {year}
            {realizedProfit !== 0 && (<> · <CurrencyAmount value={realizedProfit} currency="DZD" semantic="auto" size="sm" decimals={0} showSign/></>)}
          </>)}>
          <Button type="button" onClick={() => { onExportMonthly(); onClose(); }} className="w-full gap-2 font-bold" disabled={!monthlyHasData}>
            <DownloadCloudIcon className="h-4 w-4"/>
            {monthlyHasData ? t('portfolio.downloadMonthlyReport') : t('portfolio.noDataThisMonth')}
          </Button>
        </ExportBlock>

        <ExportBlock icon={<UsersIcon className="h-5 w-5"/>} tone="dzd" title={t('reports.clientReport') as string}>
          <div>
            <Label>{t('portfolio.clientName')}</Label>
            <SearchableSelect value={clientId} onChange={setClientId} options={sortedClients.map((client) => ({ value: client.id, label: getClientFullName(client) }))} fieldClassName="mt-1" searchPlaceholder={t('reports.searchClient') as string} emptyOptionLabel={t('reports.selectClient') as string} emptyValue=""/>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>{t('portfolio.month')}</Label>
              <Select value={clientMonth} onChange={(event) => setClientMonth(Number(event.target.value))} className="mt-1">
                {reportMonths(clientYear).map((name, index) => <option key={name} value={index}>{name}</option>)}
              </Select>
            </div>
            <div>
              <Label>{t('portfolio.year')}</Label>
              <Select value={clientYear} onChange={(event) => setClientYear(Number(event.target.value))} className="mt-1">
                {reportYears.map((option) => <option key={option} value={option}>{option}</option>)}
              </Select>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => { if (clientId) { onExportClient(clientId, clientMonth, clientYear); onClose(); } }} className="w-full gap-2 font-bold" disabled={!clientId}>
            <DownloadCloudIcon className="h-4 w-4"/>
            {clientId ? t('portfolio.downloadClientReport') : t('portfolio.chooseClientFirst')}
          </Button>
        </ExportBlock>
      </div>
    </BottomSheet>);
}
