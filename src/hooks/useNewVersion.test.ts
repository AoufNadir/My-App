import assert from 'node:assert/strict';
import { entryOf } from './useNewVersion';
import { isStaleChunkError } from '../components/ErrorBoundary';
assert.equal(entryOf('<script type="module" crossorigin src="/assets/index-OW7FHkNV.js"></script>'), '/assets/index-OW7FHkNV.js');
assert.equal(entryOf('<html></html>'), null);
assert.equal(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/A.js')), true);
assert.equal(isStaleChunkError(new Error('Importing a module script failed.')), true);
assert.equal(isStaleChunkError(new Error('x is undefined')), false);
console.log('useNewVersion: ok');
