import assert from 'node:assert/strict';
import { evaluateNumericExpression, parseAndEvaluate } from '../utils';

assert.equal(parseAndEvaluate('5'), 5);
assert.equal(parseAndEvaluate('1800'), 1800);
assert.equal(parseAndEvaluate('1 800,50'), 1800.5);
assert.equal(parseAndEvaluate('1000 + 800 / 2'), 1400);
assert.equal(parseAndEvaluate('(1000 + 800) / 2'), 900);
assert.equal(parseAndEvaluate('-5 + 10'), 5);

assert.deepEqual(evaluateNumericExpression('abc'), {
    success: false,
    error: 'common.invalidChars',
});
assert.deepEqual(evaluateNumericExpression('5+'), {
    success: false,
    error: 'common.invalidSyntax',
});
assert.deepEqual(evaluateNumericExpression('5/0'), {
    success: false,
    error: 'common.invalidExpression',
});

console.log('numberParsing tests passed');
