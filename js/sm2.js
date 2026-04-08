const SM2 = (() => {
  function defaultProgress() {
    return {
      interval: 1,
      repetitions: 0,
      easeFactor: 2.5,
      nextReviewDate: Date.now(),
      lastReviewDate: null,
      totalReviews: 0,
      correctStreak: 0,
    };
  }

  // quality: 4 = Know, 1 = Don't Know
  function review(progress, quality) {
    const p = Object.assign({}, progress);
    const now = Date.now();

    p.totalReviews += 1;
    p.lastReviewDate = now;

    if (quality < 3) {
      p.repetitions = 0;
      p.interval = 1;
      p.correctStreak = 0;
    } else {
      if (p.repetitions === 0) {
        p.interval = 1;
      } else if (p.repetitions === 1) {
        p.interval = 6;
      } else {
        p.interval = Math.round(p.interval * p.easeFactor);
      }
      p.repetitions += 1;
      p.correctStreak += 1;
    }

    p.easeFactor = p.easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
    if (p.easeFactor < 1.3) p.easeFactor = 1.3;

    p.nextReviewDate = now + p.interval * 86400000;

    return p;
  }

  function isDue(progress) {
    return progress.nextReviewDate <= Date.now();
  }

  function isLearned(progress) {
    return progress.repetitions >= 2 && progress.interval >= 4;
  }

  function buildStudyQueue(cards, progressMap) {
    const now = Date.now();
    const due = [];
    const newCards = [];
    const future = [];

    for (const card of cards) {
      const p = progressMap[card.id];
      if (!p || p.totalReviews === 0) {
        newCards.push(card.id);
      } else if (p.nextReviewDate <= now) {
        due.push({ id: card.id, nextReviewDate: p.nextReviewDate });
      } else {
        future.push({ id: card.id, nextReviewDate: p.nextReviewDate });
      }
    }

    due.sort((a, b) => a.nextReviewDate - b.nextReviewDate);
    future.sort((a, b) => a.nextReviewDate - b.nextReviewDate);

    return [
      ...due.map(x => x.id),
      ...newCards,
      ...future.map(x => x.id),
    ];
  }

  function getStats(cards, progressMap) {
    let learned = 0;
    let due = 0;
    let newCount = 0;
    const now = Date.now();

    for (const card of cards) {
      const p = progressMap[card.id];
      if (!p || p.totalReviews === 0) {
        newCount += 1;
      } else {
        if (isLearned(p)) learned += 1;
        if (p.nextReviewDate <= now) due += 1;
      }
    }

    return { total: cards.length, learned, due, new: newCount };
  }

  return { defaultProgress, review, isDue, isLearned, buildStudyQueue, getStats };
})();
