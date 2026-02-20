const STORAGE_KEY = 'my_credit_cards';
const DEFAULT_CARDS_URL = './data/sample-cards.json';
let cardsState = [];
let currentTab = 'search';
let editCardId = null;
const expandedRuleKeywords = new Set();
const MANAGE_RULE_CHIP_LIMIT = 6;

const CARD_COLOR_OPTIONS = [
  '藍色系',
  '綠色系',
  '紅色系',
  '紫色系',
  '金黃色系',
  '黑色系',
  '銀灰色系',
];

const DEFAULT_CARD_COLOR = '藍色系';

function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeText(v) {
  return (v ?? '').toString();
}

function norm(v) {
  return safeText(v).trim().toLowerCase();
}

function escapeHTML(str) {
  return safeText(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseKeywords(raw) {
  return safeText(raw)
    .split(/[\s,，、]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseKeywordsForChips(raw) {
  return safeText(raw)
    .split(/[\n,，]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseAmountPerMile(valueText) {
  const text = safeText(valueText).trim();
  if (!text) return null;
  const matched = text.match(/(\d+(?:\.\d+)?)/);
  if (!matched) return null;
  const amount = Number(matched[1]);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function formatMilesText(amountPerMile) {
  const amount = parseNumber(amountPerMile);
  if (!amount || amount <= 0) return '';
  return `${amount}元/哩`;
}

function getRewardMode(rule) {
  const percentage = parseNumber(rule?.percentage) ?? 0;
  if (percentage > 0) return 'percentage';
  const amountPerMile = parseNumber(rule?.amountPerMile);
  if (amountPerMile && amountPerMile > 0) return 'mile';
  const parsedAmount = parseAmountPerMile(rule?.valueText);
  return parsedAmount ? 'mile' : 'percentage';
}

function normalizeRule(rule) {
  const normalizedRate = parseNumber(rule?.percentage);
  const percentage = normalizedRate && normalizedRate > 0 ? normalizedRate : 0;
  const rawAmountPerMile = parseNumber(rule?.amountPerMile);
  const amountPerMileFromText = parseAmountPerMile(rule?.valueText);
  const amountPerMile = rawAmountPerMile && rawAmountPerMile > 0 ? rawAmountPerMile : amountPerMileFromText;
  const mode = percentage > 0 ? 'percentage' : amountPerMile ? 'mile' : 'percentage';

  return {
    id: safeText(rule?.id).trim() || uid('rule'),
    category: safeText(rule?.category).trim(),
    percentage: mode === 'percentage' ? percentage : 0,
    amountPerMile: mode === 'mile' ? amountPerMile : null,
    valueText: mode === 'mile' ? formatMilesText(amountPerMile) : '',
    keywords: Array.isArray(rule?.keywords) ? rule.keywords.join(', ') : safeText(rule?.keywords).trim(),
    note: safeText(rule?.note).trim(),
  };
}

function setInitMessage(message, isError = false) {
  const el = document.getElementById('init-message');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('error', isError);
}

function equivalentRate(rule, cardName) {
  const percentage = parseNumber(rule.percentage) ?? 0;
  let rate = percentage;

  const valueText = formatMilesText(rule.amountPerMile) || safeText(rule.valueText);
  if (/元\s*\/?\s*哩|元\s*1\s*哩/.test(valueText)) {
    const matched = valueText.match(/(\d+(?:\.\d+)?)/);
    if (matched) {
      const n = Number(matched[1]);
      if (n > 0) rate = (1 / n) * 100;
    }
  }

  if (cardName.includes('CUBE') && percentage > 0) rate = (percentage / 360) * 1000;
  else if (cardName.includes('Live+') && percentage > 0) rate = percentage * 2;
  else if (cardName.includes('GoGo') && percentage > 0) rate = (percentage / 11) * 13;
  else if (cardName.includes('旅人')) rate = (1 / 18) * 100;
  else if (cardName.includes('飛行')) rate = (1 / 22) * 100;

  return Number.isFinite(rate) ? rate : 0;
}

function rewardBadgeMainText(rule) {
  const percentage = parseNumber(rule.percentage) ?? 0;
  const valueText = formatMilesText(rule.amountPerMile) || safeText(rule.valueText).trim();
  if (percentage > 0) return `${percentage}%`;
  return valueText || '—';
}

function rewardBadgeSubText(rule) {
  const percentage = parseNumber(rule.percentage) ?? 0;
  if (percentage > 0) return safeText(rule.valueText).trim();
  return '';
}

function highlightText(text, query) {
  const source = safeText(text);
  const q = norm(query);
  if (!q) return escapeHTML(source);
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rgx = new RegExp(escaped, 'ig');
  return escapeHTML(source).replace(rgx, (m) => `<mark>${m}</mark>`);
}

function normalizeCards(cards) {
  return (Array.isArray(cards) ? cards : []).map((card) => ({
    id: safeText(card?.id).trim() || uid('card'),
    bank: safeText(card?.bank).trim(),
    name: safeText(card?.name).trim(),
    color: CARD_COLOR_OPTIONS.includes(safeText(card?.color).trim()) ? safeText(card?.color).trim() : DEFAULT_CARD_COLOR,
    rules: (Array.isArray(card?.rules) ? card.rules : []).map((rule) => normalizeRule(rule)),
  }));
}

function saveCards() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cardsState));
}

function tryParseLocalCards(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function loadDefaultCards() {
  try {
    const res = await fetch(DEFAULT_CARDS_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('fetch failed');
    const payload = await res.json();
    if (!Array.isArray(payload)) throw new Error('shape invalid');
    const normalized = normalizeCards(payload);
    setInitMessage('');
    return normalized;
  } catch {
    setInitMessage('無法載入預設卡包資料，已使用空白資料啟動。', true);
    return [];
  }
}

async function hydrateCardsFromDefault() {
  const fallbackCards = await loadDefaultCards();
  cardsState = fallbackCards;
  saveCards();
}

async function loadCards() {
  const localData = tryParseLocalCards(localStorage.getItem(STORAGE_KEY));
  if (localData) {
    cardsState = normalizeCards(localData);
    return;
  }

  await hydrateCardsFromDefault();
}

function flattenMatches(query) {
  const q = norm(query);
  if (!q) return [];
  const rows = [];

  for (const card of cardsState) {
    for (const rule of card.rules) {
      const category = norm(rule.category);
      const keywords = parseKeywords(rule.keywords);
      const hitCategory = category.includes(q);
      const hitKeyword = keywords.some((kw) => norm(kw).includes(q));
      if (!hitCategory && !hitKeyword) continue;

      rows.push({
        card,
        rule,
        keywordList: keywords,
        equivalentRate: equivalentRate(rule, card.name),
      });
    }
  }

  return rows.sort((a, b) => b.equivalentRate - a.equivalentRate);
}


function cardHeaderTemplate(card, actionsHTML = '') {
  return `
    <header class="credit-card-header" data-color="${escapeHTML(card.color || DEFAULT_CARD_COLOR)}">
      <div>
        <div class="bank-name">${escapeHTML(card.bank || '未填寫發卡銀行')}</div>
        <div class="card-name">${escapeHTML(card.name || '未命名信用卡')}</div>
      </div>
      ${actionsHTML ? `<div class="manage-actions">${actionsHTML}</div>` : ''}
    </header>
  `;
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
  container.innerHTML = items
    .map(({ card, rule, keywordList, equivalentRate: rate }) => `
      <article class="credit-card">
        ${cardHeaderTemplate(card)}
        <div class="credit-card-body">
          <div class="rule-layout">
            <div class="rule-main-block">
              <div class="info-label">回饋類型</div>
              <div class="info-main">${escapeHTML(rule.category || '一般回饋')}</div>
              <div class="rule-channel-label">適用關鍵字</div>
              <div class="rule-subline">${highlightText(keywordList.join('、'), query) || '-'}</div>
              ${rule.note ? `<div class="rule-note"><span aria-hidden="true">💡</span><span>${escapeHTML(rule.note)}</span></div>` : ''}
            </div>
            <div class="rule-metrics-badge">
              <div class="rate-text">${escapeHTML(rewardBadgeMainText(rule))}</div>
              ${rewardBadgeSubText(rule) ? `<div class="value-text">${escapeHTML(rewardBadgeSubText(rule))}</div>` : ''}
              <div class="weight-text">權重：約 ${rate.toFixed(2)}%</div>
            </div>
          </div>
        </div>
      </article>
    `)
    .join('');
}

function renderManageList() {
  const container = document.getElementById('manage-list');
  if (!cardsState.length) {
    container.innerHTML = '<div class="muted">目前沒有卡片，請新增。</div>';
    return;
  }

  container.innerHTML = cardsState
    .map((card) => {
      const rows = card.rules
        .map((rule) => {
          const chips = parseKeywordsForChips(rule.keywords);
          const ruleKey = `${card.id}__${rule.id}`;
          const isExpanded = expandedRuleKeywords.has(ruleKey);
          const visibleCount = isExpanded ? chips.length : Math.min(MANAGE_RULE_CHIP_LIMIT, chips.length);
          const hiddenCount = chips.length - visibleCount;
          const controlChip =
            chips.length > MANAGE_RULE_CHIP_LIMIT
              ? `<button type="button" class="chip chip-control" data-chip-toggle="${escapeHTML(ruleKey)}">${
                  isExpanded ? '收合' : `＋${hiddenCount}`
                }</button>`
              : '';
          const channelArea = chips.length
            ? `
              <div class="rule-channel-label">適用通路</div>
              <div class="rule-chip-list">
                ${chips
                  .slice(0, visibleCount)
                  .map((chip) => `<span class="chip">${escapeHTML(chip)}</span>`)
                  .join('')}
                ${controlChip}
              </div>
            `
            : '<div class="rule-channel">依條件與商店類型適用</div>';

          return `
          <div class="rule-row">
            <div class="rule-main-block">
              <div class="rule-title">${escapeHTML(rule.category || '未分類回饋')}</div>
              ${channelArea}
              ${rule.note ? `<div class="rule-note"><span aria-hidden="true">💡</span><span>${escapeHTML(rule.note)}</span></div>` : ''}
            </div>
            <div class="rule-metrics-badge">
              <div class="rate-text">${escapeHTML(rewardBadgeMainText(rule))}</div>
              ${rewardBadgeSubText(rule) ? `<div class="value-text">${escapeHTML(rewardBadgeSubText(rule))}</div>` : ''}
              <div class="weight-text">權重：${equivalentRate(rule, card.name).toFixed(2)}%</div>
            </div>
          </div>
        `;
        })
        .join('');

      return `
      <article class="credit-card">
        ${cardHeaderTemplate(
          card,
          `
            <button class="icon-action" data-edit-id="${card.id}" aria-label="編輯">✏️</button>
            <button class="icon-action danger" data-del-id="${card.id}" aria-label="刪除">🗑️</button>
          `,
        )}
        <div class="credit-card-body">
          <div class="card-section-title">已設定的回饋規則</div>
          <div class="rules-list">${rows}</div>
        </div>
      </article>`;
    })
    .join('');
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-content').forEach((el) => el.classList.toggle('active', el.dataset.tab === tab));
  document.querySelectorAll('.bottom-tabs button').forEach((el) => el.classList.toggle('active', el.dataset.tab === tab));
}

function ruleEditorTemplate(rule = {}) {
  const rewardMode = getRewardMode(rule);
  const percentageValue = rewardMode === 'percentage' ? rule.percentage ?? '' : '';
  const amountPerMileValue = rewardMode === 'mile' ? parseNumber(rule.amountPerMile) ?? '' : '';

  return `
  <section class="card-box rule-editor">
    <div class="row">
      <div>
        <label>回饋類型</label>
        <input name="category" value="${escapeHTML(rule.category || '')}" placeholder="例如：超商 / 餐飲 / 海外" />
      </div>
      <div>
        <label>回饋形式</label>
        <div class="reward-toggle" role="tablist" aria-label="回饋形式">
          <button type="button" class="reward-option ${rewardMode === 'percentage' ? 'active' : ''}" data-reward-mode="percentage">回饋率（%）</button>
          <button type="button" class="reward-option ${rewardMode === 'mile' ? 'active' : ''}" data-reward-mode="mile">幾元換 1 哩</button>
        </div>
      </div>
      <div class="row two">
        <div class="reward-field ${rewardMode === 'percentage' ? '' : 'hidden'}" data-field="percentage">
          <label>回饋率（%）</label>
          <input name="percentage" value="${percentageValue}" placeholder="例如：3.8" ${rewardMode === 'percentage' ? '' : 'disabled'} />
        </div>
        <div class="reward-field ${rewardMode === 'mile' ? '' : 'hidden'}" data-field="mile">
          <label>幾元換 1 哩</label>
          <input name="amountPerMile" value="${amountPerMileValue}" placeholder="例如：20（代表 20元/哩）" ${rewardMode === 'mile' ? '' : 'disabled'} />
          <div class="field-helper">例如：20（代表 20元/哩）</div>
        </div>
      </div>
      <div>
        <label>適用通路關鍵字</label>
        <input name="keywords" value="${escapeHTML(rule.keywords || '')}" placeholder="7-11 超商 ibon" />
      </div>
      <div>
        <label>備註/提示</label>
        <textarea name="note" placeholder="例如：需切換【集精選】">${escapeHTML(rule.note || '')}</textarea>
        ${rule.note ? '' : '<div class="field-helper">若需要提醒切換權益/方案，請填寫在「備註/提示」欄位。</div>'}
      </div>
      <div class="btn-row">
        <button type="button" class="danger remove-rule">刪除這條規則</button>
      </div>
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

  const rulesContainer = document.getElementById('rules-container');
  rulesContainer.innerHTML = (card?.rules?.length ? card.rules : [{}]).map((r) => ruleEditorTemplate(r)).join('');
  document.getElementById('editor-modal').classList.add('show');
}

function closeEditor() {
  document.getElementById('editor-modal').classList.remove('show');
  editCardId = null;
}

function collectEditorForm() {
  const bank = document.getElementById('card-bank').value.trim();
  const name = document.getElementById('card-name').value.trim();
  const color = document.getElementById('card-theme').value || DEFAULT_CARD_COLOR;
  if (!bank || !name) throw new Error('請填寫發卡銀行與信用卡名稱');

  const rules = [...document.querySelectorAll('.rule-editor')]
    .map((el) => {
      const percentageValue = el.querySelector('input[name="percentage"]').value.trim();
      const amountPerMileValue = el.querySelector('input[name="amountPerMile"]').value.trim();
      return {
        id: uid('rule'),
        category: el.querySelector('input[name="category"]').value.trim(),
        percentage: percentageValue === '' ? 0 : parseNumber(percentageValue),
        amountPerMile: amountPerMileValue === '' ? null : parseNumber(amountPerMileValue),
        valueText: '',
        keywords: el.querySelector('input[name="keywords"]').value.trim(),
        note: el.querySelector('textarea[name="note"]').value.trim(),
      };
    })
    .map((rule) => normalizeRule(rule))
    .filter((rule) => rule.category || rule.keywords || rule.percentage > 0 || (rule.amountPerMile ?? 0) > 0 || rule.note);

  if (!rules.length) throw new Error('至少需要一條回饋規則');

  return { bank, name, color, rules };
}

function initThemeOptions() {
  const select = document.getElementById('card-theme');
  if (!select) return;
  select.innerHTML = CARD_COLOR_OPTIONS.map((color) => `<option value="${color}">${color}</option>`).join('');
  select.value = DEFAULT_CARD_COLOR;
}

function bindEvents() {
  const triggerSearch = () => {
    const q = document.getElementById('search-input').value;
    renderSearchResult(flattenMatches(q), q);
  };

  document.getElementById('search-input').addEventListener('input', triggerSearch);

  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') triggerSearch();
  });

  document.getElementById('clear-search-btn').addEventListener('click', () => {
    document.getElementById('search-input').value = '';
    triggerSearch();
  });

  document.querySelectorAll('.bottom-tabs button').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('manage-list').addEventListener('click', (e) => {
    const editId = e.target.getAttribute('data-edit-id');
    const delId = e.target.getAttribute('data-del-id');
    const ruleToggle = e.target.getAttribute('data-chip-toggle');

    if (ruleToggle) {
      if (expandedRuleKeywords.has(ruleToggle)) expandedRuleKeywords.delete(ruleToggle);
      else expandedRuleKeywords.add(ruleToggle);
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
    const shouldReset = confirm('確定要重置卡片資料嗎？這會清除你目前的卡包設定。');
    if (!shouldReset) return;

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
  });

  document.getElementById('rules-container').addEventListener('click', (e) => {
    const modeBtn = e.target.closest('[data-reward-mode]');
    if (modeBtn) {
      const editor = modeBtn.closest('.rule-editor');
      if (!editor) return;
      const mode = modeBtn.dataset.rewardMode;
      const percentageInput = editor.querySelector('input[name="percentage"]');
      const mileInput = editor.querySelector('input[name="amountPerMile"]');
      const percentageField = editor.querySelector('[data-field="percentage"]');
      const mileField = editor.querySelector('[data-field="mile"]');

      editor.querySelectorAll('[data-reward-mode]').forEach((btn) => btn.classList.toggle('active', btn === modeBtn));

      if (mode === 'percentage') {
        percentageField.classList.remove('hidden');
        mileField.classList.add('hidden');
        percentageInput.disabled = false;
        mileInput.disabled = true;
        mileInput.value = '';
      } else {
        mileField.classList.remove('hidden');
        percentageField.classList.add('hidden');
        mileInput.disabled = false;
        percentageInput.disabled = true;
        percentageInput.value = '';
      }
      return;
    }

    if (e.target.classList.contains('remove-rule')) {
      const all = document.querySelectorAll('.rule-editor');
      if (all.length === 1) return;
      e.target.closest('.rule-editor').remove();
    }
  });

  document.getElementById('editor-save').addEventListener('click', () => {
    try {
      const payload = collectEditorForm();
      if (editCardId) {
        cardsState = cardsState.map((card) => (card.id === editCardId ? { ...card, ...payload } : card));
      } else {
        cardsState.unshift({ id: uid('card'), ...payload });
      }
      saveCards();
      renderManageList();
      closeEditor();
      switchTab('manage');
    } catch (error) {
      alert(error.message);
    }
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
