const assert = require('assert');
const { computeEquivalentRateFromReward } = require('../reward.js');

function approxEqual(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) < epsilon, `expected ${actual} to be near ${expected}`);
}

approxEqual(computeEquivalentRateFromReward({ type: 'miles', spend: 18, miles: 1 }), 5.5555555556);
approxEqual(computeEquivalentRateFromReward({ type: 'miles', spend: 22, miles: 1 }), 4.5454545455);
approxEqual(computeEquivalentRateFromReward({ type: 'percentage', percentage: 3, multiplier: 2 }), 6);
approxEqual(computeEquivalentRateFromReward({ type: 'ratio', basePercentage: 3, numerator: 13, denominator: 11 }), 3.5454545455);
approxEqual(computeEquivalentRateFromReward({ type: 'ratio', basePercentage: 3, numerator: 1000, denominator: 360 }), 8.3333333333);

assert.strictEqual(computeEquivalentRateFromReward({ type: 'percentage', percentage: 0, multiplier: 2 }), 0);
assert.strictEqual(computeEquivalentRateFromReward({ type: 'miles', spend: -1, miles: 1 }), 0);
assert.strictEqual(computeEquivalentRateFromReward({ type: 'ratio', basePercentage: 3, numerator: 2, denominator: 0 }), 0);
assert.strictEqual(computeEquivalentRateFromReward({ type: 'unknown', foo: 1 }), 0);

console.log('reward tests passed');
