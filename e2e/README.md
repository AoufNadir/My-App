# Browser tests (V24-3)

`npm run e2e` runs the app's everyday paths in a real browser, on **fake data** only:

1. builds the app with `VITE_E2E_EMULATOR=1` into `dist-e2e/` (the published build never has this variable);
2. starts the Firebase emulator (Auth + Firestore, project `demo-prodigital`, with the real `firestore.rules`);
3. starts the preview, seeds `e2e/seed.mjs`, runs `e2e/flows.mjs`, then stops everything.

Flows: sign-in and home, a cash USDT sale to a client (the Caisse grows by the sale and « Envoyer au client » is
offered), delete then « Annuler » (every figure back), the client page, the treasury and its inventory, no JavaScript
error. A failed flow leaves a screenshot `e2e/.fail-N.png`.

Needs Java (for the emulator) and Playwright's Chromium. `FIREBASE_TOOLS` can point to an installed `firebase` binary;
otherwise `npx firebase-tools@13.29.1` is used.
