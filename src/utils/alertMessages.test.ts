import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { translations } from '../translations';
import { KNOWN_ALERT_TEMPLATES, translateAlert } from './alertMessages';
import { walletDisplayName } from './formMessages';

// The messages shown after a save stay written in French where they are made (the handlers
// do not change); the toast shows them in the reader's language. Every message the app can
// show is checked here: in Arabic it has no French left, in French it is shown as written.

const lookup = (lang: 'fr' | 'ar', key: string): unknown => key.split('.').reduce<any>((node, part) => node?.[part], translations[lang]);
const tAr = (key: string) => lookup('ar', key) ?? key;
const tFr = (key: string) => lookup('fr', key) ?? key;

// Each template has its Arabic text, which uses only the {parts} the French message carries
// (« un seul investisseur » needs no count).
const keysOf = readFileSync(new URL('./alertMessages.ts', import.meta.url), 'utf8').matchAll(/\[(?:'(?:[^'\\]|\\.)*'|"[^"]*"), '(alerts\.\w+)'\]/g);
const templateKeys = [...keysOf].map((match) => match[1]);
assert.equal(templateKeys.length, KNOWN_ALERT_TEMPLATES.length, 'one key per template');
const parts = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
templateKeys.forEach((key, index) => {
    const ar = lookup('ar', key);
    assert.equal(typeof ar, 'string', `${key} has an Arabic text`);
    const extra = parts(ar as string).filter((part) => !parts(KNOWN_ALERT_TEMPLATES[index]).includes(part));
    assert.deepEqual(extra, [], `${key} uses only the parts of its French message`);
});

// Every setAlert(...) of the app, read from the source: literals, templates (a {hole} per
// value), both sides of ?: and of ||.
const SRC = fileURLToPath(new URL('..', import.meta.url));
const files: string[] = [];
(function walk(dir: string) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
            if (!/^(translations|testing)$/.test(name))
                walk(path);
        }
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.|\.d\.ts$/.test(name))
            files.push(path);
    }
})(SRC);
function texts(node: ts.Expression, sf: ts.SourceFile): string[] {
    if (ts.isParenthesizedExpression(node))
        return texts(node.expression, sf);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
        return [node.text];
    if (ts.isTemplateExpression(node)) {
        let outs = [node.head.text];
        for (const span of node.templateSpans) {
            const inner = ts.isConditionalExpression(span.expression) ? texts(span.expression, sf) : ['{value}'];
            outs = outs.flatMap((out) => inner.map((part) => out + part + span.literal.text)).slice(0, 16);
        }
        return outs;
    }
    if (ts.isConditionalExpression(node))
        return [...texts(node.whenTrue, sf), ...texts(node.whenFalse, sf)];
    if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.BarBarToken || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken))
        return [...texts(node.left, sf), ...texts(node.right, sf)];
    return ['{value}'];
}
const messages = new Map<string, string>();
for (const file of files) {
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    (function visit(node: ts.Node) {
        if (ts.isCallExpression(node) && node.arguments.length > 0) {
            const callee = node.expression;
            const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
            if (name === 'setAlert') {
                const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                for (const text of texts(node.arguments[0], sf))
                    if (!messages.has(text))
                        messages.set(text, `${relative(SRC, file)}:${line}`);
            }
        }
        ts.forEachChild(node, visit);
    })(sf);
}
assert.ok(messages.size > 120, `the source scan finds the app's messages (${messages.size})`);

// A value filled in at run time ({value}) is shown here as a number. Messages that are only
// a value, or a translated text with an emoji, are already in the reader's language.
const SAME_IN_BOTH = /^(USDT|EUR|DZD|PAM|PMA|PDF|Enregistrer|BaridiMob|RedotPay|Binance|WhatsApp|Read|Models)$/;
const notTranslated: string[] = [];
for (const [message, where] of messages) {
    const shown = message.replace(/\{value\}/g, '120');
    if (!/[A-Za-zÀ-ÿ]{3,}/.test(shown))
        continue;
    assert.equal(translateAlert(shown, 'fr', tFr), shown, `French is shown as written: ${where}`);
    const ar = translateAlert(shown, 'ar', tAr);
    const french = (ar.match(/[A-Za-zÀ-ÿ’']{3,}/g) || []).filter((word) => !SAME_IN_BOTH.test(word));
    if (french.length)
        notTranslated.push(`${where}  ${JSON.stringify(message)} → ${JSON.stringify(ar)}`);
}
assert.deepEqual(notTranslated, [], 'every message reads in Arabic');

// The values inside a message follow too: wallets and periods.
assert.equal(translateAlert('⚠️ Solde Caisse insuffisant.', 'ar', tAr), `⚠️ ${(tAr('alerts.walletInsufficient') as string).replace('{wallet}', walletDisplayName('Caisse', tAr))}`);
assert.ok(!translateAlert('⚠️ Solde Caisse insuffisant.', 'ar', tAr).includes('Caisse'), 'the wallet name is translated too');
const period = translateAlert("Relevé client Karim - Du 01/09/2026 au 30/09/2026 prêt. Enregistrez en PDF depuis l'impression.", 'ar', tAr);
assert.ok(period.includes('01/09/2026') && period.includes('30/09/2026') && !/\bDu\b|\bau\b/.test(period), `period in Arabic: ${period}`);
// A message the list does not know is shown as it came, never emptied.
assert.equal(translateAlert('Message inconnu 42', 'ar', tAr), 'Message inconnu 42');

console.log(`alertMessages.test: the ${messages.size} messages of the app read in Arabic, and stay as written in French`);
