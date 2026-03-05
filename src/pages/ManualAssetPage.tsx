import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ManualAsset, ManualAssetClient } from '../types';
import { ManualAssetClientsPanel } from '../components/manual-asset/ManualAssetClientsPanel';
import { ManualAssetClientDialogs } from '../components/manual-asset/ManualAssetClientDialogs';
import { ManualAssetHeaderStats } from '../components/manual-asset/ManualAssetHeaderStats';
import { useManualAssetClientManager } from '../hooks/useManualAssetClientManager';

type ManualAssetPageProps = {
  asset: ManualAsset;
  clients: ManualAssetClient[];
  clientBalances: Map<string, number>;
  onBack: () => void;
  onSelectClient: (client: ManualAssetClient) => void;
  onCreateClient: (fullName: string, phone?: string, email?: string, notes?: string) => void;
  onUpdateClient: (clientId: string, data: { fullName: string; phone?: string; email?: string; notes?: string; balance?: number }) => void;
  onDeleteClient: (clientId: string) => void;
  isDark: boolean;
  cardBase: string;
  fieldBase: string;
  subtleText: string;
};

export function ManualAssetPage({
  asset,
  clients,
  clientBalances,
  onBack,
  onSelectClient,
  onCreateClient,
  onUpdateClient,
  onDeleteClient,
  isDark,
  cardBase,
  fieldBase,
  subtleText
}: ManualAssetPageProps) {
  const {
    searchQuery,
    setSearchQuery,
    isCreateClientModalOpen,
    setIsCreateClientModalOpen,
    isEditClientModalOpen,
    clientForm,
    setClientForm,
    filteredClients,
    openCreateModal,
    openEditModal,
    closeEditModal,
    handleCreate,
    handleUpdate
  } = useManualAssetClientManager({
    assetId: asset.id,
    clients,
    clientBalances,
    onCreateClient,
    onUpdateClient
  });

  const totalBalance = useMemo(
    () => Array.from(clientBalances.values()).reduce((acc, val) => acc + val, 0),
    [clientBalances]
  );

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      <ManualAssetHeaderStats
        assetName={asset.name}
        assetDescription={asset.description}
        totalBalance={totalBalance}
        clientsCount={clients.length}
        onBack={onBack}
        isDark={isDark}
        subtleText={subtleText}
      />

      <ManualAssetClientsPanel
        isDark={isDark}
        subtleText={subtleText}
        fieldBase={fieldBase}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenCreateModal={openCreateModal}
        filteredClients={filteredClients}
        assetId={asset.id}
        clientBalances={clientBalances}
        onSelectClient={onSelectClient}
        onOpenEditModal={openEditModal}
        onDeleteClient={onDeleteClient}
      />

      <ManualAssetClientDialogs
        isDark={isDark}
        cardBase={cardBase}
        fieldBase={fieldBase}
        subtleText={subtleText}
        isCreateClientModalOpen={isCreateClientModalOpen}
        isEditClientModalOpen={isEditClientModalOpen}
        clientForm={clientForm}
        setClientForm={setClientForm}
        onCloseCreateModal={() => setIsCreateClientModalOpen(false)}
        onCloseEditModal={closeEditModal}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />
    </motion.div>
  );
}
