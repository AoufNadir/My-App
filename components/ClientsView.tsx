import React, { useState } from 'react';
import { PlusIcon } from './icons/PlusIcon';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon';
import { BanknotesIcon } from './icons/BanknotesIcon';
import { CreditCardIcon } from './icons/CreditCardIcon';
import { UsersIcon as UserGroupIcon } from './icons/UsersIcon';

// --- Placeholders for Missing Components (To be implemented in next steps) ---
const ClientList = ({ clients, filter, searchTerm }: any) => (
  <div className="bg-gray-800/50 rounded-xl p-8 text-center border border-gray-700 border-dashed">
    <UserGroupIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
    <p className="text-gray-400">Liste des clients ({clients.length})</p>
    <p className="text-xs text-gray-500 mt-1">Le composant ClientList sera intégré ici.</p>
  </div>
);

const AddClientModal = ({ onClose }: any) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full border border-gray-700">
      <h3 className="text-xl font-bold text-white mb-4">Ajouter un Client</h3>
      <p className="text-gray-400 text-sm mb-6">Le formulaire d'ajout sera disponible prochainement.</p>
      <button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors">
        Fermer
      </button>
    </div>
  </div>
);
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

  const positionNette = totalAvances - totalDettes;

  // --- 3. Calculate Total Capital ---
  const capitalTotal = caisseBalance + baridiBalance + positionNette;

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header & Add Button */}
      <div className="flex justify-between items-center px-1">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Trésorerie</h1>
          <p className="text-gray-400 text-xs mt-1">Caisse, Baridi & Clients</p>
        </div>
        <button 
          onClick={() => setIsAddClientModalOpen(true)}
          className="bg-blue-600 p-3 rounded-full shadow-lg shadow-blue-900/20 text-white hover:bg-blue-500 transition-colors"
        >
          <PlusIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Financial Dashboard Grid */}
      <div className="grid grid-cols-2 gap-3">
        
        {/* Capital Total (Hero Card) */}
        <div className="col-span-2 bg-gradient-to-br from-emerald-900 to-emerald-800 p-5 rounded-2xl border border-emerald-700/50 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>
          <p className="text-emerald-200 text-xs font-medium uppercase tracking-wider mb-1 relative z-10">Capital Total (Estimé)</p>
          <h2 className="text-3xl font-bold text-white relative z-10">
            {capitalTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
            <span className="text-sm text-emerald-300 font-normal ml-1">DZD</span>
          </h2>
        </div>

        {/* Caisse (Cash) */}
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700/50 flex flex-col justify-between hover:border-blue-500/30 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <BanknotesIcon className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-gray-400 text-xs font-medium">Caisse</span>
          </div>
          <p className="text-lg font-bold text-blue-100 truncate">
            {caisseBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* BaridiMob */}
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700/50 flex flex-col justify-between hover:border-yellow-500/30 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <CreditCardIcon className="w-5 h-5 text-yellow-400" />
            </div>
            <span className="text-gray-400 text-xs font-medium">BaridiMob</span>
          </div>
          <p className="text-lg font-bold text-yellow-100 truncate">
            {baridiBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Dettes (Negative) */}
        <div className="bg-red-500/5 p-4 rounded-xl border border-red-500/20">
          <p className="text-red-400 text-xs mb-1 font-medium">Dettes (Crédits)</p>
          <p className="text-lg font-bold text-red-500 truncate">
            {totalDettes.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Avances (Positive) */}
        <div className="bg-green-500/5 p-4 rounded-xl border border-green-500/20">
          <p className="text-green-400 text-xs mb-1 font-medium">Avances</p>
          <p className="text-lg font-bold text-green-500 truncate">
            {totalAvances.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Position Nette */}
        <div className="col-span-2 bg-gray-800/50 p-3 px-4 rounded-xl border border-gray-700/50 flex justify-between items-center">
          <span className="text-gray-400 text-xs font-medium">Position Nette</span>
          <span className={`text-lg font-bold ${positionNette >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {positionNette > 0 ? '+' : ''}{positionNette.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD
          </span>
        </div>
      </div>

      {/* Clients List Section */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4 px-1">
            <UserGroupIcon className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-white">Liste des Clients</h3>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-3.5 text-gray-500" />
          <input 
            type="text" 
            placeholder="Rechercher un client..." 
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-600 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Client List Component */}
        <ClientList clients={clients || []} filter={'ALL'} searchTerm={searchTerm} />
      </div>

      {/* Add Client Modal */}
      {isAddClientModalOpen && (
        <AddClientModal onClose={() => setIsAddClientModalOpen(false)} />
      )}

    </div>
  );
};

export default ClientsView;