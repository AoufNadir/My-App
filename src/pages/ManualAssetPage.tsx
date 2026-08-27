import React, { useMemo } from 'react';
import { ManualAsset, ManualAssetClient, ManualAssetTransaction } from '../types';
import { ManualAssetClientsPanel } from '../components/manual-asset/ManualAssetClientsPanel';
import { ManualAssetClientDialogs } from '../components/manual-asset/ManualAssetClientDialogs';
import { ManualAssetHeaderStats } from '../components/manual-asset/ManualAssetHeaderStats';
import { ManualAssetReportsSection } from '../components/manual-asset/ManualAssetReportsSection';
import { useManualAssetClientManager } from '../hooks/useManualAssetClientManager';
type ManualAssetPageProps = {
    asset: ManualAsset;
    clients: ManualAssetClient[];
    assetTransactions: ManualAssetTransaction[];
    clientBalances: Map<string, number>;
    onBack: () => void;
    onSelectClient: (client: ManualAssetClient) => void;
    onCreateClient: (fullName: string, phone?: string, email?: string, notes?: string) => void;
    onUpdateClient: (clientId: string, data: {
        fullName: string;
        phone?: string;
        email?: string;
        notes?: string;
        balance?: number;
    }) => void;
    onDeleteClient: (clientId: string) => void;
};
export function ManualAssetPage({ asset, clients, assetTransactions, clientBalances, onBack, onSelectClient, onCreateClient, onUpdateClient, onDeleteClient }: ManualAssetPageProps) {
    const { searchQuery, setSearchQuery, isCreateClientModalOpen, setIsCreateClientModalOpen, isEditClientModalOpen, clientForm, setClientForm, filteredClients, openCreateModal, openEditModal, closeEditModal, handleCreate, handleUpdate } = useManualAssetClientManager({
        assetId: asset.id,
        clients,
        clientBalances,
        onCreateClient,
        onUpdateClient
    });
    const balanceStats = useMemo(() => {
        let amountToReceive = 0;
        let clientAdvances = 0;
        for (const client of clients) {
            const balance = clientBalances.get(`${asset.id}_${client.id}`) || 0;
            if (balance < -0.005)
                amountToReceive += Math.abs(balance);
            else if (balance > 0.005)
                clientAdvances += balance;
        }
        return {
            amountToReceive,
            clientAdvances,
            netCapitalImpact: amountToReceive - clientAdvances
        };
    }, [asset.id, clients, clientBalances]);
    return (<div className="anim-page-in space-y-4">
      <ManualAssetHeaderStats assetName={asset.name} assetDescription={asset.description} amountToReceive={balanceStats.amountToReceive} clientAdvances={balanceStats.clientAdvances} netCapitalImpact={balanceStats.netCapitalImpact} clientsCount={clients.length} onBack={onBack}/>

      <ManualAssetClientsPanel searchQuery={searchQuery} setSearchQuery={setSearchQuery} onOpenCreateModal={openCreateModal} filteredClients={filteredClients} assetId={asset.id} clientBalances={clientBalances} onSelectClient={onSelectClient} onOpenEditModal={openEditModal} onDeleteClient={onDeleteClient}/>

      <ManualAssetReportsSection assetId={asset.id} assetName={asset.name} clients={clients} assetTransactions={assetTransactions} clientBalances={clientBalances}/>

      <ManualAssetClientDialogs isCreateClientModalOpen={isCreateClientModalOpen} isEditClientModalOpen={isEditClientModalOpen} clientForm={clientForm} setClientForm={setClientForm} onCloseCreateModal={() => setIsCreateClientModalOpen(false)} onCloseEditModal={closeEditModal} onCreate={handleCreate} onUpdate={handleUpdate}/>
    </div>);
}
