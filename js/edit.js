(() => {
  const AI_PROMPT = `Please generate a flashcard set in JSON format for me to study [TOPIC].

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
- Ensure accuracy — do not guess on definitions

Replace [TOPIC] with your desired topic before sending this prompt.`;

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

  function showFeedback(msg, isValid) {
    const el = document.getElementById('json-feedback');
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

      const normalCard = {
        id,
        front: card.front.trim(),
        back: card.back.trim(),
      };
      if (card.hint && typeof card.hint === 'string' && card.hint.trim()) {
        normalCard.hint = card.hint.trim();
      }

      normalized.push(normalCard);

      // Preserve existing SM-2 progress if card ID matches
      if (oldProgressMap && oldProgressMap[id]) {
        newProgress[id] = oldProgressMap[id];
      } else {
        newProgress[id] = SM2.defaultProgress();
      }
    }

    return { cards: normalized, progress: newProgress };
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback: show modal
      return false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    editingSetId = getParam('id');

    if (editingSetId) {
      existingSet = Storage.getSet(editingSetId);
      if (!existingSet) {
        window.location.href = 'index.html';
        return;
      }
      document.getElementById('nav-title').textContent = 'Edit Set';
      document.getElementById('page-title').textContent = 'Edit Card Set';
      document.getElementById('input-name').value = existingSet.name;

      // Pre-fill JSON with current cards (stripped of progress)
      const cardsJson = {
        name: existingSet.name,
        cards: (existingSet.cards || []).map(c => {
          const o = { front: c.front, back: c.back };
          if (c.hint) o.hint = c.hint;
          return o;
        }),
      };
      document.getElementById('input-json').value = JSON.stringify(cardsJson, null, 2);
    }

    // Copy AI prompt
    document.getElementById('btn-copy-prompt').addEventListener('click', async () => {
      const copied = await copyToClipboard(AI_PROMPT);
      if (copied) {
        showToast('AI prompt copied to clipboard!');
      } else {
        // Show fallback modal
        document.getElementById('prompt-text').value = AI_PROMPT;
        document.getElementById('modal-prompt').hidden = false;
      }
    });

    // Validate button
    document.getElementById('btn-validate').addEventListener('click', () => {
      const raw = document.getElementById('input-json').value;
      if (!raw.trim()) {
        showFeedback('JSON textarea is empty.', false);
        return;
      }
      const result = validateJson(raw);
      showFeedback(result.message, result.ok);

      // Auto-fill name if empty and JSON has name
      if (result.ok && result.parsed.name) {
        const nameInput = document.getElementById('input-name');
        if (!nameInput.value.trim()) {
          nameInput.value = result.parsed.name;
        }
      }
    });

    // Clear textarea
    document.getElementById('btn-clear').addEventListener('click', () => {
      document.getElementById('input-json').value = '';
      const fb = document.getElementById('json-feedback');
      fb.className = 'json-feedback';
      fb.textContent = '';
    });

    // Cancel
    document.getElementById('btn-cancel').addEventListener('click', () => {
      window.location.href = 'index.html';
    });

    // Fallback modal controls
    document.getElementById('modal-prompt-close').addEventListener('click', () => {
      document.getElementById('modal-prompt').hidden = true;
    });
    document.getElementById('modal-select-all').addEventListener('click', () => {
      const ta = document.getElementById('prompt-text');
      ta.select();
      ta.setSelectionRange(0, 99999);
    });
    document.getElementById('modal-prompt').addEventListener('click', e => {
      if (e.target === e.currentTarget) document.getElementById('modal-prompt').hidden = true;
    });

    // Form submit
    document.getElementById('edit-form').addEventListener('submit', e => {
      e.preventDefault();

      const name = document.getElementById('input-name').value.trim();
      if (!name) {
        showToast('Please enter a set name.');
        return;
      }

      const raw = document.getElementById('input-json').value.trim();
      if (!raw) {
        showToast('Please paste card JSON.');
        return;
      }

      const result = validateJson(raw);
      if (!result.ok) {
        showFeedback(result.message, false);
        showToast('Fix JSON errors before saving.');
        return;
      }

      const oldProgress = existingSet ? (existingSet.progress || {}) : {};
      const { cards, progress } = normalizeCards(result.parsed.cards, oldProgress);

      const setData = {
        id: editingSetId || undefined,
        name,
        cards,
        progress,
        createdAt: existingSet ? existingSet.createdAt : undefined,
      };

      Storage.saveSet(setData);
      window.location.href = 'index.html';
    });
  });
})();
