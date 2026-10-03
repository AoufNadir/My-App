import { useLanguage } from '../../contexts/LanguageContext';

export type PageSkeletonKind = 'dashboard' | 'list' | 'detail' | 'stats';

/** La forme de la page qui se charge : liste, fiche, page de chiffres ou accueil. */
export function getPageSkeletonKind(view: string, hasSelection = false): PageSkeletonKind {
    if (view === 'dashboard')
        return 'dashboard';
    if (hasSelection)
        return 'detail';
    if (view === 'transactions' || view === 'dzd' || view === 'services')
        return 'list';
    return 'stats';
}

const BAR_CLASS = 'block animate-pulse bg-neutral-200';
function Bar({ className = '' }: { className?: string }) {
    return <span className={`${BAR_CLASS} ${className.includes('rounded-') ? '' : 'rounded-md'} ${className}`}/>;
}

function Circle({ className = 'h-10 w-10' }: { className?: string }) {
    return <span className={`block shrink-0 animate-pulse rounded-full bg-neutral-200 ${className}`}/>;
}

function HeroSkeleton({ withAvatar = false, withActions = false }: { withAvatar?: boolean; withActions?: boolean }) {
    return (<div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        {withAvatar && <Circle className="h-12 w-12"/>}
        <div className="min-w-0 flex-1">
          <Bar className="h-3 w-28"/>
          <Bar className="mt-2.5 h-8 w-44"/>
        </div>
      </div>
      {withActions
        ? (<div className="mt-4 grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((index) => <span key={index} className={`${BAR_CLASS} h-[4.5rem] rounded-button`}/>)}
          </div>)
        : (<div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
            <Bar className="h-3 w-32"/>
            <Bar className="h-4 w-20"/>
          </div>)}
    </div>);
}

function RowsSkeleton({ rows }: { rows: number }) {
    return (<div className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="flex min-h-12 items-center px-4 pt-1">
        <Bar className="h-3.5 w-32"/>
      </div>
      {Array.from({ length: rows }, (_, index) => (<div key={index} className="flex min-h-14 items-center gap-3 border-t border-border px-4 py-3 first:border-t-0">
          <Circle/>
          <div className="min-w-0 flex-1">
            <Bar className="h-3.5 w-2/5"/>
            <Bar className="mt-2 h-3 w-3/5"/>
          </div>
          <Bar className="h-4 w-16"/>
        </div>))}
    </div>);
}

function TilesSkeleton() {
    return (<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[0, 1, 2, 3].map((index) => (<div key={index} className="rounded-card border border-border bg-surface p-3">
          <Bar className="h-3 w-3/5"/>
          <Bar className="mt-2.5 h-5 w-4/5"/>
        </div>))}
    </div>);
}

/** Squelette de chargement d'une page, aux formes des cartes de l'accueil. */
export function PageSkeleton({ kind }: { kind: PageSkeletonKind }) {
    const { t } = useLanguage();
    return (<div role="status" aria-busy="true" aria-live="polite" className="anim-page-in flex flex-col gap-3" data-skeleton={kind}>
      <span className="sr-only">{t('dashboard.loadingAria')}</span>
      {kind === 'list' && (<>
          <div className="flex items-center justify-between gap-3">
            <Bar className="h-6 w-36"/>
            <Bar className="h-10 w-28 rounded-button"/>
          </div>
          <Bar className="h-11 w-full rounded-button"/>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((index) => <span key={index} className={`${BAR_CLASS} h-9 w-20 rounded-full`}/>)}
          </div>
          <RowsSkeleton rows={6}/>
        </>)}
      {kind === 'detail' && (<>
          <div className="flex items-center gap-2">
            <Circle className="h-9 w-9"/>
            <Bar className="h-6 flex-1"/>
            <Bar className="h-9 w-16 rounded-button"/>
          </div>
          <HeroSkeleton withAvatar withActions/>
          <RowsSkeleton rows={5}/>
        </>)}
      {kind === 'stats' && (<>
          <HeroSkeleton/>
          <TilesSkeleton/>
          <RowsSkeleton rows={4}/>
        </>)}
      {kind === 'dashboard' && (<>
          <HeroSkeleton/>
          <TilesSkeleton/>
          <RowsSkeleton rows={3}/>
        </>)}
    </div>);
}
