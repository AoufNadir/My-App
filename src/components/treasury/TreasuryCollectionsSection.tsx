import { Button } from '../ui/Button';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { PlusIcon } from '../icons/PlusIcon';
import { Trash2Icon } from '../icons/Trash2Icon';
import { PencilIcon } from '../icons/PencilIcon';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { ManualAsset, ManualAssetClient, TreasuryCard } from '../../types';
import { formatDzd } from '../../pages/shared/pageFormat';

type TreasuryCollectionsSectionProps = {
  isDark: boolean;
  subtleText: string;
  treasuryCards: TreasuryCard[];
  openTreasuryCardModal: (card?: TreasuryCard) => void;
  setTreasuryCardToDelete: (card: TreasuryCard | null) => void;
  manualAssets: ManualAsset[];
  manualAssetClients: ManualAssetClient[];
  assetBalances: Map<string, number>;
  onOpenManualAsset: (asset: ManualAsset) => void;
  onOpenCreateManualAsset: () => void;
  onDeleteManualAsset: (assetId: string) => void;
};

export function TreasuryCollectionsSection({
  isDark,
  subtleText,
  treasuryCards,
  openTreasuryCardModal,
  setTreasuryCardToDelete,
  manualAssets,
  manualAssetClients,
  assetBalances,
  onOpenManualAsset,
  onOpenCreateManualAsset,
  onDeleteManualAsset
}: TreasuryCollectionsSectionProps) {
  const assetClientCount = new Map<string, number>();
  manualAssetClients.forEach((client) => {
    assetClientCount.set(client.assetId, (assetClientCount.get(client.assetId) || 0) + 1);
  });

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <UnifiedTitle
            as="h3"
            isDark={isDark}
            variant="section"
            icon={<CreditCardIcon className="w-4 h-4" />}
          >
            Cartes de Tresorerie
          </UnifiedTitle>
          <Button onClick={() => openTreasuryCardModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg flex items-center gap-2 text-sm font-bold">
            <PlusIcon className="w-4 h-4" /> Ajouter
          </Button>
        </div>

        {treasuryCards.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {treasuryCards.map((card) => (
              <div key={card.id} className={`p-5 rounded-2xl shadow-sm border transition-all relative group ${isDark ? 'bg-[#1E293B] border-[#334155]' : 'bg-white border-slate-200'}`}>
                <div className={`flex items-center justify-between text-sm font-medium mb-2 ${subtleText}`}>
                  <span>{card.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openTreasuryCardModal(card)}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1.5 hover:bg-blue-500/20 rounded-full text-blue-500"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setTreasuryCardToDelete(card)}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-500/20 rounded-full text-red-500"
                    >
                      <Trash2Icon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {formatDzd(Number(card.value) || 0, { min: 2, max: 2 })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`p-8 rounded-2xl border border-dashed text-center ${isDark ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-400'}`}>
            Aucune carte ajoutee.
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <UnifiedTitle
            as="h3"
            isDark={isDark}
            variant="section"
            icon={<BriefcaseIcon className="w-4 h-4" />}
          >
            Actifs Manuels
          </UnifiedTitle>
          <Button onClick={onOpenCreateManualAsset} className="bg-teal-600 hover:bg-teal-700 text-white p-2 rounded-lg flex items-center gap-2 text-sm font-bold">
            <PlusIcon className="w-4 h-4" /> Creer
          </Button>
        </div>

        {manualAssets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {manualAssets.map((asset) => {
              const balance = assetBalances.get(asset.id) || 0;
              const clientCount = assetClientCount.get(asset.id) || 0;

              return (
                <div
                  key={asset.id}
                  onClick={() => onOpenManualAsset(asset)}
                  className={`p-5 rounded-2xl shadow-sm border transition-all relative group cursor-pointer hover:scale-[1.02] ${isDark ? 'bg-[#1E293B] border-[#334155] hover:bg-[#263345]' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                >
                  <div className={`flex items-center justify-between text-sm font-medium mb-2 ${subtleText}`}>
                    <span>{asset.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteManualAsset(asset.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-500/20 rounded-full text-red-500"
                    >
                      <Trash2Icon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatDzd(balance, { min: 2, max: 2 })}
                  </div>
                  <div className={`text-xs mt-2 ${subtleText} flex items-center gap-2`}>
                    <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">{clientCount} Clients</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`p-8 rounded-2xl border border-dashed text-center ${isDark ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-400'}`}>
            Aucun actif manuel cree.
          </div>
        )}
      </div>
    </>
  );
}
