(() => {
  let setId = null;
  let cardSet = null;
  let progressMap = {};
  let queue = [];
  let originalQueueLength = 0;
  let currentCardId = null;
  let isFlipped = false;
  let sessionResults = { known: 0, dontKnow: 0 };
  let animating = false;

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function getCardById(id) {
    return cardSet.cards.find(c => c.id === id) || null;
  }

  function buildQueue() {
    queue = SM2.buildStudyQueue(cardSet.cards, progressMap);
    originalQueueLength = queue.length;
  }

  function updateNavCounter() {
    const answered = originalQueueLength - queue.length - (currentCardId ? 0 : 0);
    const done = originalQueueLength - queue.length;
    document.getElementById('nav-counter').textContent =
      `${done}/${originalQueueLength}`;
  }

  function updateSessionBar() {
    const done = originalQueueLength - queue.length;
    const pct = originalQueueLength > 0 ? Math.round((done / originalQueueLength) * 100) : 0;
    document.getElementById('session-bar').style.width = pct + '%';
  }

  function showCard(cardId) {
    currentCardId = cardId;
    isFlipped = false;

    const card = getCardById(cardId);
    if (!card) return;

    const flipCardEl = document.getElementById('flip-card');
    const wasFlipped = flipCardEl.classList.contains('is-flipped');

    // Front face is invisible while card is flipped — safe to update immediately
    document.getElementById('front-text').textContent = card.front;
    document.getElementById('front-hint').textContent = card.hint || '';

    if (wasFlipped) {
      animating = true;
      flipCardEl.classList.remove('is-flipped');
      // Update back content only after flip-back animation completes (back face invisible)
      setTimeout(() => {
        document.getElementById('back-text').textContent = card.back;
        document.getElementById('back-original').textContent = card.front;
        animating = false;
      }, 520);
    } else {
      document.getElementById('back-text').textContent = card.back;
      document.getElementById('back-original').textContent = card.front;
      animating = false;
    }

    updateNavCounter();
    updateSessionBar();
  }

  function flipCard() {
    if (isFlipped || animating) return;
    animating = true;
    isFlipped = true;
    document.getElementById('flip-card').classList.add('is-flipped');
    setTimeout(() => { animating = false; }, 520);
  }

  function handleKnow() {
    if (!isFlipped || !currentCardId) return;
    const p = progressMap[currentCardId] || SM2.defaultProgress();
    const updated = SM2.review(p, 4);
    progressMap[currentCardId] = updated;
    Storage.saveProgress(setId, currentCardId, updated);
    sessionResults.known += 1;
    nextCard();
  }

  function handleDontKnow() {
    if (!isFlipped || !currentCardId) return;
    const p = progressMap[currentCardId] || SM2.defaultProgress();
    const updated = SM2.review(p, 1);
    progressMap[currentCardId] = updated;
    Storage.saveProgress(setId, currentCardId, updated);
    sessionResults.dontKnow += 1;

    // Re-insert in back third of remaining queue
    const insertAt = queue.length > 2
      ? Math.floor(queue.length * 0.66) + Math.floor(Math.random() * Math.ceil(queue.length * 0.34))
      : queue.length;
    queue.splice(insertAt, 0, currentCardId);

    nextCard();
  }

  function nextCard() {
    if (queue.length === 0) {
      showSessionComplete();
      return;
    }
    const nextId = queue.shift();
    showCard(nextId);
  }

  function showSessionComplete() {
    document.getElementById('study-area').hidden = true;
    document.getElementById('session-complete').hidden = false;
    document.getElementById('session-bar').style.width = '100%';

    const total = sessionResults.known + sessionResults.dontKnow;
    const accuracy = total > 0 ? Math.round((sessionResults.known / total) * 100) : 0;

    document.getElementById('stat-known').textContent = sessionResults.known;
    document.getElementById('stat-unknown').textContent = sessionResults.dontKnow;
    document.getElementById('stat-total').textContent = cardSet.cards.length;
    document.getElementById('stat-accuracy').textContent = accuracy + '%';
  }

  function showCaughtUp() {
    document.getElementById('study-area').hidden = true;
    const nextDates = (cardSet.cards || [])
      .map(c => (progressMap[c.id] || {}).nextReviewDate)
      .filter(Boolean)
      .sort((a, b) => a - b);

    let msg = 'No cards are due for review right now.';
    if (nextDates.length > 0) {
      const next = new Date(nextDates[0]);
      msg = `Next review: ${next.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}.`;
    }
    document.getElementById('caught-up-msg').textContent = msg;
    document.getElementById('caught-up').hidden = false;
  }

  function startSession() {
    // Reset state
    sessionResults = { known: 0, dontKnow: 0 };
    document.getElementById('session-complete').hidden = true;
    document.getElementById('caught-up').hidden = true;
    document.getElementById('study-area').hidden = false;

    progressMap = Storage.getProgress(setId);
    buildQueue();

    if (queue.length === 0) {
      showCaughtUp();
      return;
    }

    const firstId = queue.shift();
    showCard(firstId);
  }

  document.addEventListener('DOMContentLoaded', () => {
    setId = getParam('id');
    if (!setId) { window.location.href = 'index.html'; return; }

    cardSet = Storage.getSet(setId);
    if (!cardSet || !cardSet.cards || cardSet.cards.length === 0) {
      window.location.href = 'index.html';
      return;
    }

    document.getElementById('nav-set-name').textContent = cardSet.name;

    // Flip on card front click
    document.getElementById('flip-card').addEventListener('click', () => {
      if (!isFlipped) flipCard();
    });

    document.getElementById('btn-know').addEventListener('click', e => {
      e.stopPropagation();
      handleKnow();
    });

    document.getElementById('btn-dont-know').addEventListener('click', e => {
      e.stopPropagation();
      handleDontKnow();
    });

    document.getElementById('btn-study-again').addEventListener('click', () => {
      startSession();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!isFlipped) { flipCard(); return; }
      }
      if (e.key === 'ArrowRight' || e.key === 'k') { handleKnow(); }
      if (e.key === 'ArrowLeft' || e.key === 'd') { handleDontKnow(); }
    });

    startSession();
  });
})();
