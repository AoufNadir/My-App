import assert from 'node:assert/strict';
import {
    CLIENT_WALLET_NETWORKS,
    WALLET_SEARCH_MIN_LENGTH,
    cleanWalletAddress,
    clientWalletInputFrom,
    clientWalletMatchesQuery,
    emptyClientWalletInput,
    normalizeClientWallets,
    readClientWallets,
} from './clientWallets';

// Invented addresses: random characters, not the address of anybody.
const TRC20 = 'TSAyduyxxu5hxvF9Wjy7qqEgTR7ETpm5hx';
const BEP20 = '0xe24cf6562ce66dad398c21b61a78f731554db18c';

// The invisible characters a chat can add to copied text, written as code points to be readable here.
const mark = (codePoint: number) => String.fromCodePoint(codePoint);
const LEFT_TO_RIGHT_MARK = mark(0x200E);
const RIGHT_TO_LEFT_MARK = mark(0x200F);
const LEFT_TO_RIGHT_EMBEDDING = mark(0x202A);
const POP_DIRECTIONAL_FORMATTING = mark(0x202C);
const LEFT_TO_RIGHT_ISOLATE = mark(0x2066);
const POP_DIRECTIONAL_ISOLATE = mark(0x2069);
const ZERO_WIDTH_SPACE = mark(0x200B);
const BYTE_ORDER_MARK = mark(0xFEFF);
const WORD_JOINER = mark(0x2060);
const NO_BREAK_SPACE = mark(0x00A0);

// The networks offered, in the order they are shown.
assert.deepEqual([...CLIENT_WALLET_NETWORKS], ['TRC20', 'BEP20']);
assert.deepEqual(emptyClientWalletInput(), { TRC20: '', BEP20: '' });

// An address has no space and no invisible mark, whatever app it was copied from.
{
    assert.equal(cleanWalletAddress(`  ${TRC20}\n`), TRC20);
    assert.equal(cleanWalletAddress(`${TRC20.slice(0, 10)} ${TRC20.slice(10)}`), TRC20, 'a space in the middle is dropped');
    assert.equal(cleanWalletAddress(`${LEFT_TO_RIGHT_MARK}${BEP20}${RIGHT_TO_LEFT_MARK}`), BEP20, 'left-to-right and right-to-left marks');
    assert.equal(cleanWalletAddress(`${LEFT_TO_RIGHT_EMBEDDING}${BEP20}${POP_DIRECTIONAL_FORMATTING}`), BEP20, 'embedding marks');
    assert.equal(cleanWalletAddress(`${LEFT_TO_RIGHT_ISOLATE}${BEP20}${POP_DIRECTIONAL_ISOLATE}`), BEP20, 'isolate marks');
    assert.equal(cleanWalletAddress(`${ZERO_WIDTH_SPACE}${BEP20}${BYTE_ORDER_MARK}`), BEP20, 'zero-width space and byte order mark');
    assert.equal(cleanWalletAddress(`${BEP20.slice(0, 7)}${WORD_JOINER}${BEP20.slice(7)}`), BEP20, 'word joiner');
    assert.equal(cleanWalletAddress(`${BEP20.slice(0, 5)}${NO_BREAK_SPACE}${BEP20.slice(5)}`), BEP20, 'no-break space');
    assert.equal(cleanWalletAddress(undefined), '');
    assert.equal(cleanWalletAddress(null), '');
    assert.equal(cleanWalletAddress(42), '', 'only a text is an address');
    assert.equal(cleanWalletAddress(TRC20), TRC20, 'a clean address is left as it is, letters in their case');
    assert.equal(cleanWalletAddress('é' + TRC20), 'é' + TRC20, 'a visible character is never dropped, even an unexpected one');
}

// What the window saves: the cleaned addresses, none for an empty network, null when nothing is left.
{
    assert.deepEqual(normalizeClientWallets({ TRC20, BEP20 }), { TRC20, BEP20 });
    assert.deepEqual(normalizeClientWallets({ TRC20: ` ${TRC20} `, BEP20: '' }), { TRC20 }, 'an empty network is not stored');
    assert.deepEqual(normalizeClientWallets({ TRC20: '', BEP20: `${LEFT_TO_RIGHT_MARK}${BEP20}` }), { BEP20 });
    assert.equal(normalizeClientWallets({ TRC20: '  ', BEP20: '\n' }), null, 'blanks only: nothing to keep');
    assert.equal(normalizeClientWallets(emptyClientWalletInput()), null);
    assert.equal(normalizeClientWallets(null), null);
    assert.equal(normalizeClientWallets(undefined), null);
    assert.deepEqual(normalizeClientWallets({ TRC20, BEP20, SOLANA: 'x' } as any), { TRC20, BEP20 }, 'a network that is not offered is not stored');
}

// What is read from a client, whatever is in the document.
{
    assert.deepEqual(readClientWallets({ wallets: { TRC20, BEP20 } }), [{ network: 'TRC20', address: TRC20 }, { network: 'BEP20', address: BEP20 }]);
    assert.deepEqual(readClientWallets({ wallets: { BEP20, TRC20 } }).map((entry) => entry.network), ['TRC20', 'BEP20'], 'always in the order of the list');
    assert.deepEqual(readClientWallets({ wallets: { BEP20 } }), [{ network: 'BEP20', address: BEP20 }]);
    assert.deepEqual(readClientWallets({}), [], 'a client saved before this field existed');
    assert.deepEqual(readClientWallets({ wallets: null }), [], 'the last address was cleared');
    assert.deepEqual(readClientWallets(null), []);
    assert.deepEqual(readClientWallets(undefined), []);
    assert.deepEqual(readClientWallets({ wallets: [TRC20] as any }), [], 'a list is not the stored shape');
    assert.deepEqual(readClientWallets({ wallets: TRC20 as any }), [], 'neither is a text');
    assert.deepEqual(readClientWallets({ wallets: { TRC20: 7, BEP20: '   ' } as any }), [], 'not a text, or nothing but blanks');
    assert.deepEqual(readClientWallets({ wallets: { TRC20: ` ${TRC20}\n` } }), [{ network: 'TRC20', address: TRC20 }], 'cleaned when read too');
}

// The window starts from what is stored.
{
    assert.deepEqual(clientWalletInputFrom({ wallets: { TRC20 } }), { TRC20, BEP20: '' });
    assert.deepEqual(clientWalletInputFrom({ wallets: { TRC20, BEP20 } }), { TRC20, BEP20 });
    assert.deepEqual(clientWalletInputFrom({}), emptyClientWalletInput());
    assert.deepEqual(clientWalletInputFrom(null), emptyClientWalletInput());
}

// Saving what the window shows keeps what was stored, and clearing both texts clears the field.
{
    const stored = { wallets: { TRC20, BEP20 } };
    assert.deepEqual(normalizeClientWallets(clientWalletInputFrom(stored)), stored.wallets);
    const cleared = { ...clientWalletInputFrom(stored), TRC20: '', BEP20: '' };
    assert.equal(normalizeClientWallets(cleared), null);
}

// The search: pasting an address finds its client, a few letters do not.
{
    const client = { wallets: { TRC20, BEP20 } };
    assert.equal(WALLET_SEARCH_MIN_LENGTH, 6);
    assert.equal(clientWalletMatchesQuery(client, TRC20), true, 'the whole address');
    assert.equal(clientWalletMatchesQuery(client, BEP20), true);
    assert.equal(clientWalletMatchesQuery(client, BEP20.toUpperCase().replace('0X', '0x')), true, 'letters in any case');
    assert.equal(clientWalletMatchesQuery(client, TRC20.slice(8, 8 + WALLET_SEARCH_MIN_LENGTH)), true, 'a piece from the minimum length');
    assert.equal(clientWalletMatchesQuery(client, TRC20.slice(8, 8 + WALLET_SEARCH_MIN_LENGTH - 1)), false, 'one character less: not looked at');
    assert.equal(clientWalletMatchesQuery(client, 'a'), false);
    assert.equal(clientWalletMatchesQuery(client, 'yacine'), false, 'a name is not an address');
    assert.equal(clientWalletMatchesQuery(client, `${LEFT_TO_RIGHT_MARK}${TRC20} `), true, 'an address pasted with a mark or a space still finds it');
    assert.equal(clientWalletMatchesQuery({ wallets: { TRC20 } }, BEP20), false, 'another client\'s address');
    assert.equal(clientWalletMatchesQuery({}, TRC20), false);
    assert.equal(clientWalletMatchesQuery(null, TRC20), false);
    assert.equal(clientWalletMatchesQuery(client, ''), false);
}

console.log('clientWallets tests passed');
