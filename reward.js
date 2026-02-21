(function (globalScope) {
  function safeText(v) {
    return (v ?? '').toString();
  }

  function parseNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function parseMilesSpendFromText(valueText) {
    const text = safeText(valueText).trim();
    if (!text || !/元\s*\/?\s*哩|元\s*1\s*哩/.test(text)) return null;
    const matched = text.match(/(\d+(?:\.\d+)?)/);
    if (!matched) return null;
    const spend = Number(matched[1]);
    return Number.isFinite(spend) && spend > 0 ? spend : null;
  }

  function normalizeReward(rule, card) {
    const existingReward = rule?.reward ?? {};
    const type = safeText(existingReward.type).trim();

    if (type === 'percentage') {
      return {
        type,
        percentage: parseNumber(existingReward.percentage) ?? 0,
        multiplier: parseNumber(existingReward.multiplier) ?? 1,
      };
    }

    if (type === 'miles') {
      return {
        type,
        spend: parseNumber(existingReward.spend) ?? 0,
        miles: parseNumber(existingReward.miles) ?? 1,
      };
    }

    if (type === 'ratio') {
      return {
        type,
        basePercentage: parseNumber(existingReward.basePercentage) ?? 0,
        numerator: parseNumber(existingReward.numerator) ?? 0,
        denominator: parseNumber(existingReward.denominator) ?? 0,
      };
    }

    const amountPerMile = parseNumber(rule?.amountPerMile);
    const spendFromValueText = parseMilesSpendFromText(rule?.valueText);
    const spend = amountPerMile && amountPerMile > 0 ? amountPerMile : spendFromValueText;
    if (spend) {
      return { type: 'miles', spend, miles: 1 };
    }

    const percentage = parseNumber(rule?.percentage);
    if (percentage !== null) {
      return { type: 'percentage', percentage, multiplier: 1 };
    }

    return { type: 'percentage', percentage: 0, multiplier: 1 };
  }

  function validPositive(value) {
    return Number.isFinite(value) && value > 0;
  }

  function computeEquivalentRateFromReward(reward) {
    if (!reward || typeof reward !== 'object') return 0;

    if (reward.type === 'percentage') {
      const percentage = parseNumber(reward.percentage);
      const multiplier = parseNumber(reward.multiplier) ?? 1;
      if (!validPositive(percentage) || !validPositive(multiplier)) return 0;
      return percentage * multiplier;
    }

    if (reward.type === 'miles') {
      const spend = parseNumber(reward.spend);
      const miles = parseNumber(reward.miles) ?? 1;
      if (!validPositive(spend) || !validPositive(miles)) return 0;
      return (miles / spend) * 100;
    }

    if (reward.type === 'ratio') {
      const basePercentage = parseNumber(reward.basePercentage);
      const numerator = parseNumber(reward.numerator);
      const denominator = parseNumber(reward.denominator);
      if (!validPositive(basePercentage) || !validPositive(numerator) || !validPositive(denominator)) return 0;
      return basePercentage * (numerator / denominator);
    }

    return 0;
  }

  function computeEquivalentRate(rule, cardConfig) {
    const reward = normalizeReward(rule, cardConfig);
    const rate = computeEquivalentRateFromReward(reward);
    return Number.isFinite(rate) && rate > 0 ? rate : 0;
  }

  const api = {
    parseNumber,
    normalizeReward,
    parseMilesSpendFromText,
    computeEquivalentRateFromReward,
    computeEquivalentRate,
  };

  globalScope.RewardUtils = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
