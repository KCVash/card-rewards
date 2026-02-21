const STORAGE_KEY = 'my_credit_cards';
const DEFAULT_CARDS_URL = './data/sample-cards.json';
let cardsState = [];
let currentTab = 'search';
let editCardId = null;
const expandedRuleKeywords = new Set();
const MANAGE_RULE_CHIP_LIMIT = 6;

const CARD_COLOR_OPTIONS = ['藍色系', '綠色系', '紅色系', '紫色系', '金黃色系', '黑色系', '銀灰色系'];
const DEFAULT_CARD_COLOR = '藍色系';
const REWARD_TYPE_OPTIONS = [
  { value: 'percentage', label: '百分比回饋' },
  { value: 'miles', label: '里程累積' },
  { value: 'ratio', label: '兌換倍率（校正）' },
];

function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function safeText(v) { return (v ?? '').toString(); }
function norm(v) { return safeText(v).trim().toLowerCase(); }
function parseNumber(v) { return window.RewardUtils.parseNumber(v); }

function escapeHTML(str) {
  return safeText(str).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function parseKeywords(raw) {
  return safeText(raw).split(/[\s,，、]+/).map((s) => s.trim()).filter(Boolean);
}
function parseKeywordsForChips(raw) {
  return safeText(raw).split(/[\n,，]+/).map((s) => s.trim()).filter(Boolean);
}

function setInitMessage(message, isError = false) {
  const el = document.getElementById('init-message');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('error', isError);
}

function normalizeRule(rule, card) {
  const reward = window.RewardUtils.normalizeReward(rule, card);
  return {
    id: safeText(rule?.id).trim() || uid('rule'),
    category: safeText(rule?.category).trim(),
    reward,
    keywords: Array.isArray(rule?.keywords) ? rule.keywords.join(', ') : safeText(rule?.keywords).trim(),
    note: safeText(rule?.note).trim(),
    percentage: parseNumber(rule?.percentage) ?? 0,
    amountPerMile: parseNumber(rule?.amountPerMile),
    valueText: safeText(rule?.valueText).trim(),
  };
}

function computeEquivalentRate(rule, cardConfig) {
  return window.RewardUtils.computeEquivalentRate(rule, cardConfig);
}

function rewardDisplayText(rule) {
  const reward = window.RewardUtils.normalizeReward(rule);
  if (reward.type === 'percentage') {
    const p = parseNumber(reward.percentage) ?? 0;
    return `${p}%`;
  }
  if (reward.type === 'miles') return `${reward.spend || 0}元/${reward.miles || 1}哩`;
  if (reward.type === 'ratio') {
    const base = parseNumber(reward.basePercentage) ?? 0;
    return `${base}%`;
  }
  return '—';
}

function rewardSubText(rule) {
  const reward = window.RewardUtils.normalizeReward(rule);
  return '';
}

function rewardFormulaText(rule) {
  const reward = window.RewardUtils.normalizeReward(rule);
  if (reward.type === 'percentage') {
    const p = parseNumber(reward.percentage) ?? 0;
    const m = parseNumber(reward.multiplier) ?? 1;
    if (m !== 1) return `公式：${p}% × ${m}`;
    return '';
  }
  if (reward.type === 'miles') {
    const spend = parseNumber(reward.spend) ?? 0;
    const miles = parseNumber(reward.miles) ?? 1;
    return `公式：${miles} ÷ ${spend} × 100`;
  }
  if (reward.type === 'ratio') {
    const base = parseNumber(reward.basePercentage) ?? 0;
    const n = parseNumber(reward.numerator) ?? 0;
    const d = parseNumber(reward.denominator) ?? 0;
    return `公式：${base}% × ${n}/${d}`;
  }
  return '';
}

function normalizeCards(cards) {
  return (Array.isArray(cards) ? cards : []).map((card) => ({
    id: safeText(card?.id).trim() || uid('card'),
    bank: safeText(card?.bank).trim(),
    name: safeText(card?.name).trim(),
    color: CARD_COLOR_OPTIONS.includes(safeText(card?.color).trim()) ? safeText(card?.color).trim() : DEFAULT_CARD_COLOR,
    rules: (Array.isArray(card?.rules) ? card.rules : []).map((rule) => normalizeRule(rule, card)),
  }));
}

function saveCards() { localStorage.setItem(STORAGE_KEY, JSON.stringify(cardsState)); }
function tryParseLocalCards(raw) { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : null; } catch { return null; } }

async function loadDefaultCards() {
  try {
    const res = await fetch(DEFAULT_CARDS_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('fetch failed');
    const payload = await res.json();
    setInitMessage('');
    return normalizeCards(payload);
  } catch {
    setInitMessage('無法載入預設卡包資料，已使用空白資料啟動。', true);
    return [];
  }
}

async function hydrateCardsFromDefault() {
  cardsState = await loadDefaultCards();
  saveCards();
}

async function loadCards() {
  const localData = tryParseLocalCards(localStorage.getItem(STORAGE_KEY));
  cardsState = normalizeCards(localData || await loadDefaultCards());
  if (!localData) saveCards();
}

function highlightText(text, query) {
  const source = safeText(text);
  const q = norm(query);
  if (!q) return escapeHTML(source);
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escapeHTML(source).replace(new RegExp(escaped, 'ig'), (m) => `<mark>${m}</mark>`);
}

function iconSVG(name, extraClass = '') {
  const cls = extraClass ? ` class="${extraClass}"` : '';
  return `<svg viewBox="0 0 24 24"${cls} aria-hidden="true"><use href="./assets/icons/sprite.svg#icon-${name}"></use></svg>`;
}

function flattenMatches(query) {
  const q = norm(query);
  if (!q) return [];
  const rows = [];
  for (const card of cardsState) {
    for (const rule of card.rules) {
      const keywords = parseKeywords(rule.keywords);
      const hit = norm(rule.category).includes(q) || keywords.some((kw) => norm(kw).includes(q));
      if (!hit) continue;
      rows.push({ card, rule, keywordList: keywords, equivalentRate: computeEquivalentRate(rule, card) });
    }
  }
  return rows.sort((a, b) => b.equivalentRate - a.equivalentRate);
}

function cardHeaderTemplate(card, actionsHTML = '') {
  return `<header class="credit-card-header" data-color="${escapeHTML(card.color || DEFAULT_CARD_COLOR)}"><div><div class="bank-name">${escapeHTML(card.bank || '未填寫發卡銀行')}</div><div class="card-name">${escapeHTML(card.name || '未命名信用卡')}</div></div>${actionsHTML ? `<div class="manage-actions">${actionsHTML}</div>` : ''}</header>`;
}

function renderSearchResult(items, query) {
  const container = document.getElementById('search-results');
  const empty = document.getElementById('search-empty');
  if (!items.length) {
    container.innerHTML = '';
    empty.style.display = 'block';
    empty.textContent = query ? `找不到「${query}」相關回饋。` : '請輸入關鍵字開始搜尋。';
    return;
  }
  empty.style.display = 'none';
  container.innerHTML = items.map(({ card, rule, keywordList, equivalentRate }) => `
    <article class="credit-card">${cardHeaderTemplate(card)}
      <div class="credit-card-body"><div class="rule-layout"><div class="rule-main-block"><div class="info-label">回饋類型</div><div class="info-main">${escapeHTML(rule.category || '一般回饋')}</div><div class="rule-channel-label">適用關鍵字</div><div class="rule-subline">${highlightText(keywordList.join('、'), query) || '-'}</div>${rule.note ? `<div class="rule-note">${iconSVG('category', 'rule-note-icon')}<span>${escapeHTML(rule.note)}</span></div>` : ''}</div><div class="rule-metrics-badge"><div class="rate-text">${escapeHTML(rewardDisplayText(rule))}</div>${rewardSubText(rule) ? `<div class="value-text">${escapeHTML(rewardSubText(rule))}</div>` : ''}<div class="weight-text">權重：約 ${equivalentRate.toFixed(2)}%</div>${rewardFormulaText(rule) ? `<div class="formula-text">${escapeHTML(rewardFormulaText(rule))}</div>` : ''}</div></div></div>
    </article>`).join('');
}

function renderManageList() {
  const container = document.getElementById('manage-list');
  if (!cardsState.length) { container.innerHTML = '<div class="muted">目前沒有卡片，請新增。</div>'; return; }
  container.innerHTML = cardsState.map((card) => {
    const rows = card.rules.map((rule) => {
      const chips = parseKeywordsForChips(rule.keywords);
      const ruleKey = `${card.id}__${rule.id}`;
      const isExpanded = expandedRuleKeywords.has(ruleKey);
      const visibleCount = isExpanded ? chips.length : Math.min(MANAGE_RULE_CHIP_LIMIT, chips.length);
      const hiddenCount = chips.length - visibleCount;
      const controlChip = chips.length > MANAGE_RULE_CHIP_LIMIT ? `<button type="button" class="chip chip-control" data-chip-toggle="${escapeHTML(ruleKey)}">${isExpanded ? '收合' : `＋${hiddenCount}`}</button>` : '';
      const channelArea = chips.length ? `<div class="rule-channel-label">適用通路</div><div class="rule-chip-list">${chips.slice(0, visibleCount).map((chip) => `<span class="chip">${escapeHTML(chip)}</span>`).join('')}${controlChip}</div>` : '<div class="rule-channel">依條件與商店類型適用</div>';
      return `<div class="rule-row"><div class="rule-main-block"><div class="rule-title">${escapeHTML(rule.category || '未分類回饋')}</div>${channelArea}${rule.note ? `<div class="rule-note">${iconSVG('category', 'rule-note-icon')}<span>${escapeHTML(rule.note)}</span></div>` : ''}</div><div class="rule-metrics-badge"><div class="rate-text">${escapeHTML(rewardDisplayText(rule))}</div>${rewardSubText(rule) ? `<div class="value-text">${escapeHTML(rewardSubText(rule))}</div>` : ''}<div class="weight-text">權重：${computeEquivalentRate(rule, card).toFixed(2)}%</div>${rewardFormulaText(rule) ? `<div class="formula-text">${escapeHTML(rewardFormulaText(rule))}</div>` : ''}</div></div>`;
    }).join('');
    return `<article class="credit-card">${cardHeaderTemplate(card, `<button class="icon-action" data-edit-id="${card.id}" aria-label="編輯">${iconSVG('edit')}</button><button class="icon-action danger" data-del-id="${card.id}" aria-label="刪除">${iconSVG('trash')}</button>`)}<div class="credit-card-body"><div class="card-section-title">已設定的回饋規則</div><div class="rules-list">${rows}</div></div></article>`;
  }).join('');
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-content').forEach((el) => el.classList.toggle('active', el.dataset.tab === tab));
  document.querySelectorAll('.bottom-tabs button').forEach((el) => el.classList.toggle('active', el.dataset.tab === tab));
}

function fieldValue(rule, path, fallback = '') {
  const value = rule?.reward?.[path];
  return value ?? fallback;
}

function ruleEditorTemplate(rule = {}) {
  const reward = window.RewardUtils.normalizeReward(rule);
  const type = reward.type || 'percentage';
  return `
  <section class="card-box rule-editor">
    <div class="row">
      <div><label>回饋類型</label><input name="category" value="${escapeHTML(rule.category || '')}" placeholder="例如：超商 / 餐飲 / 海外" /></div>
      <div><label>回饋換算模式</label><div class="select-wrap"><select name="rewardType">${REWARD_TYPE_OPTIONS.map((it) => `<option value="${it.value}" ${it.value === type ? 'selected' : ''}>${it.label}</option>`).join('')}</select></div></div>
      <div class="reward-field ${type === 'percentage' ? '' : 'hidden'}" data-type="percentage"><div class="row two"><div><label>回饋百分比（%）</label><input name="reward_percentage" value="${escapeHTML(fieldValue({ reward }, 'percentage', ''))}" /></div><div><label>加倍倍率（選填）</label><input name="reward_multiplier" value="${escapeHTML(fieldValue({ reward }, 'multiplier', 1))}" /></div></div></div>
      <div class="reward-field ${type === 'miles' ? '' : 'hidden'}" data-type="miles"><div class="row two"><div><label>每消費金額（元）</label><input name="reward_spend" value="${escapeHTML(fieldValue({ reward }, 'spend', ''))}" /></div><div><label>可得哩數</label><input name="reward_miles" value="${escapeHTML(fieldValue({ reward }, 'miles', 1))}" /></div></div></div>
      <div class="reward-field ${type === 'ratio' ? '' : 'hidden'}" data-type="ratio"><div class="row three"><div><label>基礎百分比（%）</label><input name="reward_basePercentage" value="${escapeHTML(fieldValue({ reward }, 'basePercentage', ''))}" /></div><div><label>分子</label><input name="reward_numerator" value="${escapeHTML(fieldValue({ reward }, 'numerator', ''))}" /></div><div><label>分母</label><input name="reward_denominator" value="${escapeHTML(fieldValue({ reward }, 'denominator', ''))}" /></div></div></div>
      <div class="readonly-rate"><div class="readonly-rate-main" data-rate-preview>等效回饋率：約 ${computeEquivalentRate({ reward }, {}).toFixed(2)}%（用於比較與排序）</div><div class="field-helper warn" data-rate-hint></div></div>
      <div><label>適用通路關鍵字</label><input name="keywords" value="${escapeHTML(rule.keywords || '')}" placeholder="7-11 超商 ibon" /></div>
      <div><label>備註/提示</label><textarea name="note" placeholder="例如：需切換【集精選】">${escapeHTML(rule.note || '')}</textarea></div>
      <div class="btn-row"><button type="button" class="danger remove-rule">刪除這條規則</button></div>
    </div>
  </section>`;
}

function openEditor(cardId = null) {
  editCardId = cardId;
  const card = cardsState.find((it) => it.id === cardId);
  document.getElementById('editor-title').textContent = card ? '編輯卡片' : '新增卡片';
  document.getElementById('card-bank').value = card?.bank || '';
  document.getElementById('card-name').value = card?.name || '';
  document.getElementById('card-theme').value = card?.color || DEFAULT_CARD_COLOR;
  document.getElementById('rules-container').innerHTML = (card?.rules?.length ? card.rules : [{}]).map((r) => ruleEditorTemplate(r)).join('');
  refreshAllRulePreviews();
  document.getElementById('editor-modal').classList.add('show');
}
function closeEditor() { document.getElementById('editor-modal').classList.remove('show'); editCardId = null; }

function getEditorRewardPayload(editor) {
  const type = editor.querySelector('select[name="rewardType"]').value;
  const numberFrom = (name) => parseNumber(editor.querySelector(`input[name="${name}"]`)?.value.trim());
  if (type === 'percentage') return { type, percentage: numberFrom('reward_percentage'), multiplier: numberFrom('reward_multiplier') ?? 1 };
  if (type === 'miles') return { type, spend: numberFrom('reward_spend'), miles: numberFrom('reward_miles') ?? 1 };
  return { type, basePercentage: numberFrom('reward_basePercentage'), numerator: numberFrom('reward_numerator'), denominator: numberFrom('reward_denominator') };
}

function getRewardValidationHint(reward) {
  if (reward.type === 'ratio' && (parseNumber(reward.denominator) ?? 0) === 0) return '分母不可為 0。';
  const rate = window.RewardUtils.computeEquivalentRateFromReward(reward);
  return rate > 0 ? '' : '請確認必填欄位皆為大於 0 的數字。';
}

function refreshRulePreview(editor) {
  const reward = getEditorRewardPayload(editor);
  const rate = window.RewardUtils.computeEquivalentRateFromReward(reward);
  editor.querySelector('[data-rate-preview]').textContent = `等效回饋率：約 ${rate.toFixed(2)}%（用於比較與排序）`;
  editor.querySelector('[data-rate-hint]').textContent = getRewardValidationHint(reward);
}
function refreshAllRulePreviews() { document.querySelectorAll('.rule-editor').forEach((editor) => refreshRulePreview(editor)); }

function collectEditorForm() {
  const bank = document.getElementById('card-bank').value.trim();
  const name = document.getElementById('card-name').value.trim();
  const color = document.getElementById('card-theme').value || DEFAULT_CARD_COLOR;
  if (!bank || !name) throw new Error('請填寫發卡銀行與信用卡名稱');

  const rules = [...document.querySelectorAll('.rule-editor')].map((el) => normalizeRule({
    id: uid('rule'),
    category: el.querySelector('input[name="category"]').value.trim(),
    reward: getEditorRewardPayload(el),
    keywords: el.querySelector('input[name="keywords"]').value.trim(),
    note: el.querySelector('textarea[name="note"]').value.trim(),
  })).filter((rule) => rule.category || rule.keywords || computeEquivalentRate(rule, {}) > 0 || rule.note);

  if (!rules.length) throw new Error('至少需要一條回饋規則');
  return { bank, name, color, rules };
}

function initThemeOptions() {
  const select = document.getElementById('card-theme');
  select.innerHTML = CARD_COLOR_OPTIONS.map((color) => `<option value="${color}">${color}</option>`).join('');
  select.value = DEFAULT_CARD_COLOR;
}

function bindEvents() {
  const triggerSearch = () => renderSearchResult(flattenMatches(document.getElementById('search-input').value), document.getElementById('search-input').value);
  document.getElementById('search-input').addEventListener('input', triggerSearch);
  document.getElementById('search-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') triggerSearch(); });
  document.getElementById('clear-search-btn').addEventListener('click', () => { document.getElementById('search-input').value = ''; triggerSearch(); });
  document.querySelectorAll('.bottom-tabs button').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  document.getElementById('manage-list').addEventListener('click', (e) => {
    const actionTarget = e.target.closest('[data-edit-id], [data-del-id], [data-chip-toggle]');
    if (!actionTarget) return;
    const editId = actionTarget.getAttribute('data-edit-id');
    const delId = actionTarget.getAttribute('data-del-id');
    const ruleToggle = actionTarget.getAttribute('data-chip-toggle');
    if (ruleToggle) {
      if (expandedRuleKeywords.has(ruleToggle)) expandedRuleKeywords.delete(ruleToggle); else expandedRuleKeywords.add(ruleToggle);
      renderManageList();
      return;
    }
    if (editId) openEditor(editId);
    if (delId) {
      const card = cardsState.find((it) => it.id === delId);
      if (card && confirm(`確定刪除 ${card.bank}｜${card.name} ?`)) {
        cardsState = cardsState.filter((it) => it.id !== delId);
        saveCards();
        renderManageList();
      }
    }
  });

  document.getElementById('add-card-btn').addEventListener('click', () => openEditor());
  document.getElementById('reset-cards-btn').addEventListener('click', async () => {
    if (!confirm('確定要重置卡片資料嗎？這會清除你目前的卡包設定。')) return;
    localStorage.removeItem(STORAGE_KEY);
    await hydrateCardsFromDefault();
    renderManageList();
    renderSearchResult([], '');
    document.getElementById('search-input').value = '';
    switchTab('manage');
  });

  document.getElementById('editor-close').addEventListener('click', closeEditor);
  document.getElementById('editor-close-x').addEventListener('click', closeEditor);
  document.getElementById('add-rule-btn').addEventListener('click', () => {
    document.getElementById('rules-container').insertAdjacentHTML('beforeend', ruleEditorTemplate());
    refreshAllRulePreviews();
  });

  document.getElementById('rules-container').addEventListener('change', (e) => {
    const editor = e.target.closest('.rule-editor');
    if (!editor) return;
    if (e.target.matches('select[name="rewardType"]')) {
      const type = e.target.value;
      editor.querySelectorAll('.reward-field').forEach((el) => el.classList.toggle('hidden', el.dataset.type !== type));
    }
    refreshRulePreview(editor);
  });

  document.getElementById('rules-container').addEventListener('input', (e) => {
    const editor = e.target.closest('.rule-editor');
    if (editor) refreshRulePreview(editor);
  });

  document.getElementById('rules-container').addEventListener('click', (e) => {
    if (!e.target.classList.contains('remove-rule')) return;
    const all = document.querySelectorAll('.rule-editor');
    if (all.length === 1) return;
    e.target.closest('.rule-editor').remove();
  });

  document.getElementById('editor-save').addEventListener('click', () => {
    try {
      const payload = collectEditorForm();
      cardsState = editCardId ? cardsState.map((card) => (card.id === editCardId ? { ...card, ...payload } : card)) : [{ id: uid('card'), ...payload }, ...cardsState];
      saveCards();
      renderManageList();
      closeEditor();
      switchTab('manage');
    } catch (error) { alert(error.message); }
  });
}

async function init() {
  await loadCards();
  initThemeOptions();
  bindEvents();
  switchTab(currentTab);
  renderManageList();
  renderSearchResult([], '');
}

init();
