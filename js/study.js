(() => {
  let setId = null;
  let cardSet = null;
  let progressMap = {};
  let queue = [];
  let originalQueueLength = 0;
  let currentCardId = null;
  let isFlipped = false;
  let sessionResults = { known: 0, dontKnow: 0 };
  let sessionAnswers = []; // 'known' | 'unknown' per answered card
  let animating = false;
  let swapped = false;

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
    const bar = document.getElementById('session-bar');
    const total = originalQueueLength;
    if (total === 0) return;

    const answered = sessionAnswers.length;
    const remaining = total - answered;

    bar.innerHTML = '';
    bar.classList.toggle('has-segments', answered > 0);

    for (const result of sessionAnswers) {
      const seg = document.createElement('div');
      seg.className = `progress-seg ${result}`;
      bar.appendChild(seg);
    }
    for (let i = 0; i < remaining; i++) {
      const seg = document.createElement('div');
      seg.className = 'progress-seg remaining';
      bar.appendChild(seg);
    }
  }

  function showCard(cardId) {
    currentCardId = cardId;
    isFlipped = false;
    animating = false;

    const card = getCardById(cardId);
    if (!card) return;

    const frontText = swapped ? card.back : card.front;
    const backText  = swapped ? card.front : card.back;
    const hint      = swapped ? '' : (card.hint || '');

    document.getElementById('front-text').textContent = frontText;
    document.getElementById('front-hint').textContent = hint;
    document.getElementById('back-text').textContent = backText;
    document.getElementById('back-original').textContent = frontText;

    const flipCard = document.getElementById('flip-card');
    flipCard.classList.remove('is-flipped');

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
    sessionAnswers.push('known');
    nextCard();
  }

  function handleDontKnow() {
    if (!isFlipped || !currentCardId) return;
    const p = progressMap[currentCardId] || SM2.defaultProgress();
    const updated = SM2.review(p, 1);
    progressMap[currentCardId] = updated;
    Storage.saveProgress(setId, currentCardId, updated);
    sessionResults.dontKnow += 1;
    sessionAnswers.push('unknown');

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
    updateSessionBar();

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
    sessionAnswers = [];
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

    document.getElementById('btn-swap').addEventListener('click', () => {
      swapped = !swapped;
      const btn = document.getElementById('btn-swap');
      btn.classList.toggle('is-active', swapped);
      // Re-render current card without flipping
      if (currentCardId) showCard(currentCardId);
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
