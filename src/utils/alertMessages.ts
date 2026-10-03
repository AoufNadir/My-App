import { translateFormMessage, walletDisplayName } from './formMessages';

// The hooks write their messages after a save (and the save checks before it) in French, and the
// message line at the bottom of the screen used to show them as they are, also in Arabic. The line
// now looks each message up here: a {name} part is copied over from the French message, and the
// rest comes from the translations. The French text stays exactly as the hooks wrote it, and a
// message that is not listed is shown unchanged.
const ALERT_TEMPLATES: ReadonlyArray<readonly [string, string]> = [
    ['Dates incomplètes.', 'alerts.datesIncomplete'],
    ['Correction supprimée.', 'alerts.correctionDeleted'],
    ['Solde mis à jour.', 'alerts.balanceUpdated'],
    ['Erreur lors de la mise à jour du solde.', 'alerts.balanceUpdateError'],
    ['Solde {wallet} insuffisant.', 'alerts.walletInsufficient'],
    ['Transaction cliente introuvable.', 'alerts.clientTxNotFound'],
    ['Transaction service introuvable.', 'alerts.serviceTxNotFound'],
    ['La transaction source a été ouverte dans Services.', 'alerts.sourceOpenedInServices'],
    ['Montant invalide.', 'alerts.invalidAmount'],
    ['Transfert mis à jour.', 'alerts.transferUpdated'],
    ['Transfert enregistré.', 'alerts.transferSaved'],
    ['Erreur lors du transfert.', 'alerts.transferError'],
    ['Client source ou destination manquant.', 'alerts.transferClientMissing'],
    ['Le client source et le client destination doivent être différents.', 'alerts.transferSameClient'],
    ['Le montant doit être strictement positif.', 'alerts.amountMustBePositive'],
    ['Retrait investisseur supprimé.', 'alerts.investorWithdrawalDeleted'],
    ['Erreur pendant la suppression.', 'alerts.deleteErrorDuring'],
    ['Transaction liée à un service introuvable.', 'alerts.serviceLinkedTxNotFound'],
    ['Transaction introuvable.', 'alerts.txNotFound'],
    ['Transaction supprimée.', 'alerts.txDeleted'],
    ['Erreur lors de la suppression.', 'alerts.deleteError'],
    ['Transaction investisseur supprimée.', 'alerts.investorTxDeleted'],
    ['Réinitialisation globale désactivée en mode Read Models.', 'alerts.resetDisabledReadModels'],
    ['Application réinitialisée.', 'alerts.appReset'],
    ['Erreur lors de la réinitialisation.', 'alerts.resetError'],
    ['Import: {added} ajoutés, {skipped} ignorés.', 'alerts.importResultPlural'],
    ['Import: {added} ajouté, {skipped} ignorés.', 'alerts.importResultAddedOne'],
    ['Import: {added} ajoutés, {skipped} ignoré.', 'alerts.importResultSkippedOne'],
    ['Import: {added} ajouté, {skipped} ignoré.', 'alerts.importResultBothOne'],
    ['Sauvegarde téléchargée avec succès.', 'alerts.backupDownloaded'],
    ['Erreur lors de la sauvegarde.', 'alerts.backupError'],
    ['Synchronisation en cours. Réessayez dans un instant.', 'alerts.syncInProgress'],
    ['Distribution enregistrée — {count} investisseurs · {amount} DZD depuis {wallet}', 'alerts.distributionSavedMany'],
    ['Distribution enregistrée — {count} investisseur · {amount} DZD depuis {wallet}', 'alerts.distributionSavedOne'],
    ['Erreur: inconnue', 'alerts.errorUnknown'],
    ['Erreur: {detail}', 'alerts.errorWithDetail'],
    ['Image introuvable.', 'alerts.imageNotFound'],
    ['Génération de l’image impossible. Veuillez réessayer.', 'alerts.imageFailed'],
    ['Image téléchargée.', 'alerts.imageDownloaded'],
    ['Erreur de capture : {detail}', 'alerts.captureError'],
    ['Nom requis.', 'alerts.nameRequired'],
    ['Service créé.', 'alerts.serviceCreated'],
    ['Erreur lors de la création du service.', 'alerts.serviceCreateError'],
    ['Service archivé.', 'alerts.serviceArchived'],
    ['Transaction ajoutée.', 'alerts.txAdded'],
    ['Erreur lors de l’ajout de la transaction.', 'alerts.txAddError'],
    ['Client ajouté.', 'alerts.clientAdded'],
    ['Erreur lors de l’ajout du client.', 'alerts.clientAddError'],
    ['Client mis à jour.', 'alerts.clientUpdated'],
    ['Erreur lors de la mise à jour du client.', 'alerts.clientUpdateError'],
    ['Client archivé (historique financier conservé).', 'alerts.clientArchivedKeepHistory'],
    ['Erreur lors de la suppression du client.', 'alerts.clientDeleteError'],
    ['Erreur lors de l’enregistrement du client.', 'alerts.clientSaveError'],
    ['Suppression bloquée : ce client contient une opération liée.', 'alerts.clientDeleteBlocked'],
    ['Erreur lors de la suppression de l’historique du client.', 'alerts.clientHistoryDeleteError'],
    ['Veuillez sélectionner un client.', 'alerts.selectClientPlease'],
    ['Ce client a été supprimé.', 'alerts.clientWasDeleted'],
    ['Entrez un montant positif.', 'alerts.enterPositiveAmount'],
    ['Le client qui reçoit doit être différent.', 'alerts.receiverMustDiffer'],
    ['Transaction mise à jour.', 'alerts.txUpdated'],
    ['Dette transférée au client qui a reçu.', 'alerts.debtTransferred'],
    ['Droit transféré au client qui a reçu.', 'alerts.creditTransferred'],
    ['Erreur lors de l’enregistrement de la transaction.', 'alerts.txSaveError'],
    ['Dette effacée, comptée comme perte.', 'alerts.debtWrittenOff'],
    ['Solde effacé.', 'alerts.balanceCleared'],
    ["Erreur lors de l'effacement.", 'alerts.clearError'],
    ['Transfert entre clients réussi.', 'alerts.clientTransferDone'],
    ['Erreur lors du transfert entre clients.', 'alerts.clientTransferError'],
    ['Vente de service numérique mise à jour.', 'alerts.serviceSaleUpdated'],
    ['Vente de service numérique enregistrée.', 'alerts.serviceSaleSaved'],
    ['Erreur lors de l’enregistrement du service numérique.', 'alerts.serviceSaleSaveError'],
    ['Vente de service numérique supprimée.', 'alerts.serviceSaleDeleted'],
    ['Erreur lors de la suppression du service numérique.', 'alerts.serviceSaleDeleteError'],
    ['Aucun gérant défini. Désignez un investisseur comme gérant.', 'alerts.noManager'],
    ['PMA {wallet} indisponible.', 'alerts.pamUnavailable'],
    ['Montant dépasse le capital disponible.', 'alerts.exceedsAvailableCapital'],
    ['Dépense mise à jour.', 'alerts.expenseUpdated'],
    ["Avance enregistrée — elle ne sera déduite du profit qu'à la régularisation.", 'alerts.advanceSaved'],
    ['Dépense personnelle enregistrée — {amount} DZD déduit du capital.', 'alerts.personalExpenseSavedFromCapital'],
    ['Dépense personnelle enregistrée.', 'alerts.personalExpenseSaved'],
    ['Erreur lors de l’enregistrement.', 'alerts.saveError'],
    ['Avance introuvable.', 'alerts.advanceNotFound'],
    ["Le montant retourné ne peut pas dépasser l'avance ({amount} {currency}).", 'alerts.returnedExceedsAdvance'],
    ['Le montant retourné doit être positif ou zéro.', 'alerts.returnedMustBePositive'],
    ['Avance régularisée — {amount} {currency} retourné à {wallet}.', 'alerts.advanceSettledReturned'],
    ['Avance régularisée — {amount} DZD déduit du capital.', 'alerts.advanceSettledFromCapital'],
    ['Avance régularisée.', 'alerts.advanceSettled'],
    ['Erreur lors de la régularisation.', 'alerts.settleError'],
    ['Dépense supprimée.', 'alerts.expenseDeleted'],
    ['Nom de l’investisseur invalide.', 'alerts.investorNameInvalid'],
    ['Capital initial invalide.', 'alerts.initialCapitalInvalid'],
    ['Un seul gérant actif est autorisé. Gérant actuel : {name}.', 'alerts.oneManagerOnly'],
    ['Investisseur mis à jour.', 'alerts.investorUpdated'],
    ['Investisseur ajouté.', 'alerts.investorAdded'],
    ['Données de transaction invalides.', 'alerts.txDataInvalid'],
    ['Investisseur introuvable.', 'alerts.investorNotFound'],
    ['Montant dépasse le profit disponible.', 'alerts.exceedsAvailableProfit'],
    ['Montant dépasse le capital investi.', 'alerts.exceedsInvestedCapital'],
    ['Cet investisseur a un profit négatif ({amount} DZD). Régularisez avant le retrait de capital.', 'alerts.negativeProfitSettleFirst'],
    ['Transaction enregistrée.', 'alerts.txSaved'],
    ['Réinvestissement enregistré.', 'alerts.reinvestSaved'],
    ['Erreur lors du réinvestissement.', 'alerts.reinvestError'],
    ['Investisseur archivé (historique financier conservé).', 'alerts.investorArchivedKeepHistory'],
    ['Erreur lors de la suppression de l’investisseur.', 'alerts.investorDeleteError'],
    ['Sélectionnez un client.', 'alerts.selectClient'],
    ['La date de début doit être avant la date de fin.', 'alerts.startBeforeEnd'],
    ['Aucune opération trouvée pour cette période.', 'alerts.noOperationsInPeriod'],
    ['Client introuvable.', 'alerts.clientNotFound'],
    ['Impossible d’ouvrir l’aperçu PDF.', 'alerts.pdfPreviewFailed'],
    ["Relevé client {name} - {period} ouvert. Appuyez sur 'Enregistrer PDF' dans la page.", 'alerts.clientStatementOpened'],
    ["Relevé client {name} - {period} prêt. Enregistrez en PDF depuis l'impression.", 'alerts.clientStatementReady'],
    ["Rapport mensuel {month} {year} ouvert. Appuyez sur 'Enregistrer PDF' dans la page.", 'alerts.monthlyReportOpened'],
    ["Rapport mensuel {month} {year} prêt. Enregistrez en PDF depuis l'impression.", 'alerts.monthlyReportReady'],
    ['Investisseur introuvable à la date de clôture.', 'alerts.investorNotFoundAtClose'],
    ["Rapport investisseur ouvert. Appuyez sur 'Enregistrer PDF' dans la page.", 'alerts.investorReportOpened'],
    ["Rapport investisseur prêt. Enregistrez en PDF depuis l'impression.", 'alerts.investorReportReady'],
    ["Rapport dépenses ouvert. Appuyez sur 'Enregistrer PDF' dans la page.", 'alerts.expensesReportOpened'],
    ["Rapport dépenses prêt. Enregistrez en PDF depuis l'impression.", 'alerts.expensesReportReady'],
    ['Erreur lors de l’achat.', 'alerts.buyError'],
    ['Erreur lors de la vente.', 'alerts.sellError'],
    ['Ajustement enregistré.', 'alerts.adjustmentSaved'],
    ['Erreur lors de l’ajustement.', 'alerts.adjustmentError'],
    ['Frais du projet enregistrés.', 'alerts.projectCostsSaved'],
    ['Impossible de retrouver le transfert lié.', 'alerts.linkedTransferNotFound'],
    ['Paramètres de transfert invalides.', 'alerts.transferParamsInvalid'],
    ['Transfert réussi.', 'alerts.transferDone'],
    ['Aucune transaction récente à verrouiller.', 'alerts.noRecentToLock'],
    ['{count} achat(s) marqué(s) comme bloqués 24h.', 'alerts.buysLocked24h'],
    ['Erreur lors du verrouillage.', 'alerts.lockError'],
    ['Client requis.', 'alerts.serviceClientRequired'],
    ['Service numérique requis.', 'alerts.digitalServiceRequired'],
    ['Prix d’achat invalide.', 'alerts.purchasePriceInvalid'],
    ['Prix de vente invalide.', 'alerts.salePriceInvalid'],
];

type Translate = (key: string) => unknown;
type Rule = { key: string; exact?: string; pattern?: RegExp; names: string[] };

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RULES: Rule[] = ALERT_TEMPLATES.map(([template, key]) => {
    const parts = template.split(/\{(\w+)\}/);
    if (parts.length === 1)
        return { key, exact: template, names: [] };
    const names: string[] = [];
    const source = parts.map((part, index) => {
        if (index % 2 === 0)
            return escapeRegExp(part);
        names.push(part);
        return '(.*?)';
    }).join('');
    return { key, pattern: new RegExp(`^${source}$`, 'u'), names };
});
const EXACT = new Map(RULES.filter((rule) => rule.exact !== undefined).map((rule) => [rule.exact as string, rule.key]));
// Longest French text first, so that "Erreur: inconnue" wins over "Erreur: {detail}".
const PATTERNS = RULES.filter((rule) => rule.pattern).sort((a, b) => b.pattern!.source.length - a.pattern!.source.length);

/** Values that are words themselves: the wallet (Caisse, BaridiMob) and a "Du … au …" period. */
const VALUE_TRANSLATORS: Readonly<Record<string, (value: string, t: Translate) => string>> = {
    wallet: (value, t) => walletDisplayName(value, t),
    period: (value, t) => {
        const range = /^Du (.+) au (.+)$/u.exec(value);
        const template = range ? t('alerts.periodRange') : undefined;
        return range && typeof template === 'string'
            ? template.replace('{from}', range[1]).replace('{to}', range[2])
            : value;
    },
};

const LEADING_EMOJI = /^[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+\s*/u;

/** The message in the reader's language; French, and messages that are not listed, come back unchanged. */
export function translateAlert(message: string, lang: 'fr' | 'ar', t: Translate): string {
    if (!message || lang === 'fr')
        return message;
    const trimmed = message.trim();
    const prefix = LEADING_EMOJI.exec(trimmed)?.[0] ?? '';
    const body = trimmed.slice(prefix.length);
    const read = (key: string) => {
        const value = t(key);
        return typeof value === 'string' && value !== key ? value : null;
    };
    const exactKey = EXACT.get(body);
    const exact = exactKey ? read(exactKey) : null;
    if (exact)
        return prefix + exact;
    for (const rule of PATTERNS) {
        const match = rule.pattern!.exec(body);
        if (!match)
            continue;
        const template = read(rule.key);
        if (!template)
            break;
        return prefix + rule.names.reduce((text, name, index) => {
            const translateValue = VALUE_TRANSLATORS[name];
            const value = translateValue ? translateValue(match[index + 1], t) : match[index + 1];
            return text.split(`{${name}}`).join(value);
        }, template);
    }
    const formMessage = translateFormMessage(body, t);
    return formMessage && formMessage !== body ? prefix + formMessage : message;
}

/** Every French message the line knows how to translate, with its {name} parts (for the tests). */
export const KNOWN_ALERT_TEMPLATES = ALERT_TEMPLATES.map(([template]) => template);
