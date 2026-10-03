import { UNCOSTED_STOCK_MESSAGE } from './costedStock';

// The save checks in the hooks write their messages in French and the windows used to show them
// as they are, also in Arabic. The windows now look each message up here and show it in the
// reader's language; a message that is not listed is shown unchanged.
const FORM_MESSAGE_KEYS: Readonly<Record<string, string>> = {
    'Veuillez entrer la quantité': 'formErrors.quantityMissing',
    'Veuillez entrer le prix': 'formErrors.priceMissing',
    'Montant total invalide': 'formErrors.totalInvalid',
    'Veuillez sélectionner un client': 'formErrors.clientMissing',
    'Le client DZD doit etre different du client principal': 'formErrors.sameDzdClient',
    'Quantité requise': 'formErrors.quantityRequired',
    'Prix requis': 'formErrors.priceRequired',
    'Taux requis': 'formErrors.rateRequired',
    'Solde insuffisant': 'formErrors.insufficientBalance',
    "Date d'échéance requise": 'formErrors.dueDateRequired',
    "L'échéance doit être future": 'formErrors.dueDateFuture',
    'Taux EUR/DZD requis': 'formErrors.eurDzdRateRequired',
    [UNCOSTED_STOCK_MESSAGE]: 'formErrors.uncostedStock',
    'Ce client a été supprimé': 'formErrors.clientArchived',
};

type Translate = (key: string) => unknown;

/** The message in the reader's language; unknown messages come back unchanged. */
export function translateFormMessage(message: string | undefined | null, t: Translate): string | undefined {
    if (!message)
        return undefined;
    const key = FORM_MESSAGE_KEYS[message];
    const translated = key ? t(key) : undefined;
    return typeof translated === 'string' && translated !== key ? translated : message;
}

/** Every message the windows know how to translate (for the tests). */
export const KNOWN_FORM_MESSAGES = Object.keys(FORM_MESSAGE_KEYS);

const WALLET_LABEL_KEYS: Readonly<Record<string, string>> = {
    Caisse: 'transactions.cash',
    BaridiMob: 'transactions.baridi',
    Credit: 'transactions.credit',
};

/** A wallet's name in the reader's language (Caisse, BaridiMob); USDT and EUR stay as they are. */
export function walletDisplayName(wallet: string, t: Translate): string {
    const key = WALLET_LABEL_KEYS[wallet];
    const translated = key ? t(key) : undefined;
    return typeof translated === 'string' && translated !== key ? translated : wallet;
}
