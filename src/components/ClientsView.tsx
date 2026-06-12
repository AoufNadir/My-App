import React, { useState } from 'react';
import { PlusIcon } from './icons/PlusIcon';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon';
import { BanknotesIcon } from './icons/BanknotesIcon';
import { CreditCardIcon } from './icons/CreditCardIcon';
import { UsersIcon as UserGroupIcon } from './icons/UsersIcon';
import { computeCapitalSnapshot } from '../utils/capitalSnapshot';
// --- Placeholders for Missing Components (To be implemented in next steps) ---
const ClientList = ({ clients, filter, searchTerm }: any) => (<div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
    <UserGroupIcon className="w-12 h-12 text-neutral-400 mx-auto mb-3"/>
    <p className="text-neutral-600">Liste des clients ({clients.length})</p>
    <p className="text-xs text-neutral-500 mt-1">Le composant ClientList sera intégré ici.</p>
  </div>);
const AddClientModal = ({ onClose }: any) => (<div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-dialog">
      <h3 className="text-xl font-bold text-neutral-900 mb-4">Ajouter un Client</h3>
      <p className="text-neutral-500 text-sm mb-6">Le formulaire d'ajout sera disponible prochainement.</p>
      <button onClick={onClose} className="min-h-touch w-full rounded-md bg-primary py-3 font-bold text-white transition-colors hover:bg-primary-dark">
        Fermer
      </button>
    </div>
  </div>);
// --------------------------------------------------------------------------
interface ClientsViewProps {
    userProfile: any;
    clients: any[];
}
const ClientsView: React.FC<ClientsViewProps> = ({ userProfile, clients }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
    // --- 1. Safely Retrieve Balances ---
    const caisseBalance = userProfile?.caisseBalance || 0;
    const baridiBalance = userProfile?.baridiBalance || 0;
    // --- 2. Calculate Debts & Avances from Clients Array ---
    const totalDettes = (clients || []).reduce((acc, client) => {
        return (client.balance || 0) < 0 ? acc + Math.abs(client.balance) : acc;
    }, 0);
    const totalAvances = (clients || []).reduce((acc, client) => {
        return (client.balance || 0) > 0 ? acc + client.balance : acc;
    }, 0);
    const capitalSnapshot = computeCapitalSnapshot({
        caisseBalance,
        baridiBalance,
        totalDettes,
        totalAvances,
        treasuryCards: []
    });
    const positionNette = capitalSnapshot.netClientPosition;
    const capitalTotal = capitalSnapshot.totalCapital;
    return (<div className="space-y-6 animate-fade-in">

      {/* Header & Add Button */}
      <div className="flex justify-between items-center px-1">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Trésorerie</h1>
          <p className="text-neutral-500 text-xs mt-1">Caisse, Baridi & Clients</p>
        </div>
        <button onClick={() => setIsAddClientModalOpen(true)} className="min-h-touch min-w-touch rounded-full bg-primary p-3 text-white shadow-card transition-colors hover:bg-primary-dark">
          <PlusIcon className="w-6 h-6"/>
        </button>
      </div>

      {/* Financial Dashboard Grid */}
      <div className="grid grid-cols-2 gap-3">

        {/* Capital Total (Hero Card) */}
        <div className="relative col-span-2 overflow-hidden rounded-lg border border-secondary/30 bg-secondary p-5 shadow-card">
          <p className="relative z-10 mb-1 text-xs font-medium uppercase tracking-wider text-white/80">Capital Total (Estimé)</p>
          <h2 className="relative z-10 text-3xl font-bold text-white" dir="ltr">
            {capitalTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="ms-1 text-sm font-normal text-white/80">DZD</span>
          </h2>
        </div>

        {/* Caisse (Cash) */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary/40">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <BanknotesIcon className="w-5 h-5 text-primary"/>
            </div>
            <span className="text-neutral-500 text-xs font-medium">Caisse</span>
          </div>
          <p className="truncate text-lg font-bold text-primary" dir="ltr">
            {caisseBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* BaridiMob */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4 transition-colors hover:border-warning/40">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-lg bg-warning-bg p-2">
              <CreditCardIcon className="w-5 h-5 text-warning"/>
            </div>
            <span className="text-neutral-500 text-xs font-medium">BaridiMob</span>
          </div>
          <p className="truncate text-lg font-bold text-warning" dir="ltr">
            {baridiBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* Dettes (Negative) */}
        <div className="rounded-lg border border-danger/20 bg-danger-bg p-4">
          <p className="mb-1 text-xs font-medium text-danger">Dettes (Crédits)</p>
          <p className="truncate text-lg font-bold text-financial-loss" dir="ltr">
            {totalDettes.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* Avances (Positive) */}
        <div className="rounded-lg border border-success/20 bg-success-bg p-4">
          <p className="mb-1 text-xs font-medium text-success">Avances</p>
          <p className="truncate text-lg font-bold text-financial-profit" dir="ltr">
            {totalAvances.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* Position Nette */}
        <div className="col-span-2 flex items-center justify-between rounded-lg border border-border bg-surface p-3 px-4">
          <span className="text-xs font-medium text-neutral-500">Position Nette</span>
          <span className={`text-lg font-bold ${positionNette >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`} dir="ltr">
            {positionNette > 0 ? '+' : ''}{positionNette.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD
          </span>
        </div>
      </div>

      {/* Clients List Section */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4 px-1">
          <UserGroupIcon className="w-5 h-5 text-neutral-500"/>
          <h3 className="text-lg font-semibold text-neutral-900">Liste des Clients</h3>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <MagnifyingGlassIcon className="absolute start-3 top-3.5 h-5 w-5 text-neutral-400"/>
          <input type="text" placeholder="Rechercher un client..." className="min-h-touch w-full rounded-lg border border-border bg-surface py-3 ps-10 pe-4 text-neutral-900 placeholder-neutral-400 transition-all focus:outline-none focus:ring-2 focus:ring-primary" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
        </div>

        {/* Client List Component */}
        <ClientList clients={clients || []} filter={'ALL'} searchTerm={searchTerm}/>
      </div>

      {/* Add Client Modal */}
      {isAddClientModalOpen && (<AddClientModal onClose={() => setIsAddClientModalOpen(false)}/>)}

    </div>);
};
export default ClientsView;
