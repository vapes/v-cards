(() => {
  const AI_PROMPT_TEMPLATE = `Please generate a flashcard set in JSON format for me to study [TOPIC].

Return ONLY valid JSON, no explanation, no markdown code blocks. The format must be exactly:

{
  "name": "Set name here",
  "cards": [
    { "front": "term or word", "back": "definition or translation", "hint": "optional hint" },
    { "front": "term or word", "back": "definition or translation", "hint": "optional hint" }
  ]
}

Requirements:
- At least 20 cards
- "front" should be the term/word to learn
- "back" should be the definition, translation, or answer
- "hint" is optional but helpful (e.g. pronunciation, category, example usage)
- Make the cards progressively ordered from basic to advanced
- Ensure accuracy — do not guess on definitions`;

  let editingSetId = null;
  let existingSet = null;

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function showToast(msg, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.hidden = true; }, duration);
  }

  function validateJson(raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw.trim());
    } catch (e) {
      return { ok: false, message: 'Invalid JSON: ' + e.message };
    }
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, message: 'JSON must be an object with a "cards" array.' };
    }
    if (!Array.isArray(parsed.cards)) {
      return { ok: false, message: 'Missing "cards" array in JSON.' };
    }
    if (parsed.cards.length === 0) {
      return { ok: false, message: '"cards" array must have at least one card.' };
    }
    for (let i = 0; i < parsed.cards.length; i++) {
      const card = parsed.cards[i];
      if (typeof card.front !== 'string' || !card.front.trim()) {
        return { ok: false, message: `Card #${i + 1} is missing a "front" value.` };
      }
      if (typeof card.back !== 'string' || !card.back.trim()) {
        return { ok: false, message: `Card #${i + 1} is missing a "back" value.` };
      }
    }
    return { ok: true, parsed, message: `Valid! ${parsed.cards.length} cards found.` };
  }

  function showFeedback(elId, msg, isValid) {
    const el = document.getElementById(elId);
    el.textContent = msg;
    el.className = 'json-feedback ' + (isValid ? 'valid' : 'invalid');
  }

  function normalizeCards(cards, oldProgressMap) {
    const normalized = [];
    const newProgress = {};
    for (const card of cards) {
      const id = (typeof card.id === 'string' && card.id.trim())
        ? card.id.trim()
        : Storage.generateId('card');
      const normalCard = { id, front: card.front.trim(), back: card.back.trim() };
      if (card.hint && typeof card.hint === 'string' && card.hint.trim()) {
        normalCard.hint = card.hint.trim();
      }
      normalized.push(normalCard);
      newProgress[id] = (oldProgressMap && oldProgressMap[id])
        ? oldProgressMap[id]
        : SM2.defaultProgress();
    }
    return { cards: normalized, progress: newProgress };
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function buildPrompt(topic) {
    return AI_PROMPT_TEMPLATE.replace('[TOPIC]', topic || '[TOPIC]');
  }

  // ── Wizard steps ──────────────────────────────────────────
  function showStep(n) {
    [1, 2, 3].forEach(i => {
      document.getElementById(`step-${i}`).hidden = (i !== n);
    });
  }

  function initWizard() {
    // Step 1 → 2
    document.getElementById('btn-generate').addEventListener('click', async () => {
      const topic = document.getElementById('input-topic').value.trim();
      const prompt = buildPrompt(topic || '[TOPIC]');
      const copied = await copyToClipboard(prompt);

      showStep(2);

      if (!copied) {
        document.getElementById('copy-fallback-wrap').hidden = false;
        document.getElementById('prompt-fallback-text').value = prompt;
      }

      // Pre-fill set name from first line of topic
      if (topic) {
        const nameInput = document.getElementById('input-name');
        if (!nameInput.value.trim()) nameInput.value = topic.split('\n')[0].replace(/^[•\-\*]\s*/, '').trim();
      }
    });

    document.getElementById('btn-cancel-step1').addEventListener('click', () => {
      window.location.href = 'index.html';
    });

    // Step 2 → 1 (back)
    document.getElementById('btn-back-step1').addEventListener('click', () => {
      showStep(1);
    });

    // Step 2 → 3
    document.getElementById('btn-done-step2').addEventListener('click', () => {
      showStep(3);
      document.getElementById('input-json').focus();
    });

    // Step 3 → 2 (back)
    document.getElementById('btn-back-step2').addEventListener('click', () => {
      showStep(2);
    });

    // Step 3: validate
    document.getElementById('btn-validate').addEventListener('click', () => {
      const raw = document.getElementById('input-json').value;
      if (!raw.trim()) { showFeedback('json-feedback', 'JSON textarea is empty.', false); return; }
      const result = validateJson(raw);
      showFeedback('json-feedback', result.message, result.ok);
      if (result.ok && result.parsed.name) {
        const nameInput = document.getElementById('input-name');
        if (!nameInput.value.trim()) nameInput.value = result.parsed.name;
      }
    });

    // Step 3: clear
    document.getElementById('btn-clear').addEventListener('click', () => {
      document.getElementById('input-json').value = '';
      const fb = document.getElementById('json-feedback');
      fb.className = 'json-feedback';
      fb.textContent = '';
    });

    // Step 3: save
    document.getElementById('edit-form').addEventListener('submit', e => {
      e.preventDefault();
      saveSet(
        document.getElementById('input-name').value.trim(),
        document.getElementById('input-json').value.trim(),
        'json-feedback',
        null,
        null
      );
    });
  }

  // ── Edit mode (direct form) ───────────────────────────────
  function initEditMode() {
    document.getElementById('step-1').hidden = true;
    document.getElementById('edit-mode').hidden = false;

    document.getElementById('nav-title').textContent = 'Edit Set';

    document.getElementById('input-name-direct').value = existingSet.name;
    const cardsJson = {
      name: existingSet.name,
      cards: (existingSet.cards || []).map(c => {
        const o = { front: c.front, back: c.back };
        if (c.hint) o.hint = c.hint;
        return o;
      }),
    };
    document.getElementById('input-json-direct').value = JSON.stringify(cardsJson, null, 2);

    // Copy prompt button
    document.getElementById('btn-copy-prompt-edit').addEventListener('click', async () => {
      const prompt = buildPrompt(existingSet.name);
      const copied = await copyToClipboard(prompt);
      showToast(copied ? 'AI prompt copied!' : 'Copy failed — use Ctrl+C');
    });

    // Validate
    document.getElementById('btn-validate-direct').addEventListener('click', () => {
      const raw = document.getElementById('input-json-direct').value;
      if (!raw.trim()) { showFeedback('json-feedback-direct', 'JSON textarea is empty.', false); return; }
      const result = validateJson(raw);
      showFeedback('json-feedback-direct', result.message, result.ok);
      if (result.ok && result.parsed.name) {
        const nameInput = document.getElementById('input-name-direct');
        if (!nameInput.value.trim()) nameInput.value = result.parsed.name;
      }
    });

    // Clear
    document.getElementById('btn-clear-direct').addEventListener('click', () => {
      document.getElementById('input-json-direct').value = '';
      const fb = document.getElementById('json-feedback-direct');
      fb.className = 'json-feedback';
      fb.textContent = '';
    });

    // Cancel
    document.getElementById('btn-cancel-edit').addEventListener('click', () => {
      window.location.href = 'index.html';
    });

    // Save
    document.getElementById('edit-form-direct').addEventListener('submit', e => {
      e.preventDefault();
      saveSet(
        document.getElementById('input-name-direct').value.trim(),
        document.getElementById('input-json-direct').value.trim(),
        'json-feedback-direct',
        editingSetId,
        existingSet
      );
    });
  }

  function saveSet(name, raw, feedbackId, setId, existing) {
    if (!name) { showToast('Please enter a set name.'); return; }
    if (!raw) { showToast('Please paste card JSON.'); return; }
    const result = validateJson(raw);
    if (!result.ok) {
      showFeedback(feedbackId, result.message, false);
      showToast('Fix JSON errors before saving.');
      return;
    }
    const oldProgress = existing ? (existing.progress || {}) : {};
    const { cards, progress } = normalizeCards(result.parsed.cards, oldProgress);
    const setData = {
      id: setId || undefined,
      name,
      cards,
      progress,
      createdAt: existing ? existing.createdAt : undefined,
    };
    Storage.saveSet(setData);
    window.location.href = 'index.html';
  }

  // ── Init ──────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    editingSetId = getParam('id');

    if (editingSetId) {
      existingSet = Storage.getSet(editingSetId);
      if (!existingSet) { window.location.href = 'index.html'; return; }
      initEditMode();
    } else {
      initWizard();
    }
  });
})();
