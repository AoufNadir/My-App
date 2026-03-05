import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TreasuryCard, ManualAsset, ManualAssetClient } from '../types';
import { TreasurySummarySection } from '../components/treasury/TreasurySummarySection';
import { TreasuryCollectionsSection } from '../components/treasury/TreasuryCollectionsSection';

type TresoreriePageProps = {
  isDark: boolean;
  cardBase: string;
  subtleText: string;
  caisseBalance: number;
  baridiBalance: number;
  totalDettes: number;
  totalAvances: number;
  portfolioValue: number;
  openTreasuryModal: () => void;
  treasuryCards: TreasuryCard[];
  openTreasuryCardModal: (card?: TreasuryCard) => void;
  setTreasuryCardToDelete: (card: TreasuryCard | null) => void;
  openTreasuryBalanceEditModal: (asset: 'Caisse' | 'BaridiMob') => void;
  manualAssets: ManualAsset[];
  manualAssetClients: ManualAssetClient[];
  assetBalances: Map<string, number>;
  onOpenManualAsset: (asset: ManualAsset) => void;
  onOpenCreateManualAsset: () => void;
  onDeleteManualAsset: (assetId: string) => void;
};

export function TresoreriePage({
  isDark,
  subtleText,
  caisseBalance,
  baridiBalance,
  totalDettes,
  totalAvances,
  portfolioValue,
  treasuryCards,
  openTreasuryCardModal,
  setTreasuryCardToDelete,
  openTreasuryBalanceEditModal,
  manualAssets,
  manualAssetClients,
  assetBalances,
  onOpenManualAsset,
  onOpenCreateManualAsset,
  onDeleteManualAsset
}: TresoreriePageProps) {
  const [activeCardId, setActiveCardId] = React.useState<string | null>(null);

  const manualCardsTotal = useMemo(
    () => treasuryCards.reduce((acc, card) => acc + (Number(card.value) || 0), 0),
    [treasuryCards]
  );

  const dettesAbs = Math.abs(totalDettes);
  const positionNette = totalAvances - dettesAbs;
  const capitalTotal = (Number(caisseBalance) || 0)
    + (Number(baridiBalance) || 0)
    + (Number(portfolioValue) || 0)
    + manualCardsTotal
    - positionNette;

  const toggleCard = (id: string) => {
    setActiveCardId((prev) => (prev === id ? null : id));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        <TreasurySummarySection
          isDark={isDark}
          subtleText={subtleText}
          capitalTotal={capitalTotal}
          portfolioValue={portfolioValue}
          caisseBalance={caisseBalance}
          baridiBalance={baridiBalance}
          dettesAbs={dettesAbs}
          totalAvances={totalAvances}
          positionNette={positionNette}
          activeCardId={activeCardId}
          onToggleCard={toggleCard}
          openTreasuryBalanceEditModal={openTreasuryBalanceEditModal}
        />

        <TreasuryCollectionsSection
          isDark={isDark}
          subtleText={subtleText}
          treasuryCards={treasuryCards}
          openTreasuryCardModal={openTreasuryCardModal}
          setTreasuryCardToDelete={setTreasuryCardToDelete}
          manualAssets={manualAssets}
          manualAssetClients={manualAssetClients}
          assetBalances={assetBalances}
          onOpenManualAsset={onOpenManualAsset}
          onOpenCreateManualAsset={onOpenCreateManualAsset}
          onDeleteManualAsset={onDeleteManualAsset}
        />
      </div>
    </motion.div>
  );
}
