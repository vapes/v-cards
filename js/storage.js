const Storage = (() => {
  const KEY = 'vcards_data';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : { sets: {} };
    } catch {
      return { sets: {} };
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.error('localStorage write failed:', e);
    }
  }

  function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function getAllSets() {
    const data = load();
    return Object.values(data.sets).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function getSet(id) {
    const data = load();
    return data.sets[id] || null;
  }

  function saveSet(set) {
    const data = load();
    const now = Date.now();
    if (!set.id) {
      set.id = generateId('set');
      set.createdAt = now;
    }
    set.updatedAt = now;
    data.sets[set.id] = set;
    save(data);
    return set;
  }

  function deleteSet(id) {
    const data = load();
    delete data.sets[id];
    save(data);
  }

  function saveProgress(setId, cardId, progressObj) {
    const data = load();
    if (!data.sets[setId]) return;
    if (!data.sets[setId].progress) data.sets[setId].progress = {};
    data.sets[setId].progress[cardId] = progressObj;
    save(data);
  }

  function getProgress(setId) {
    const data = load();
    return (data.sets[setId] && data.sets[setId].progress) || {};
  }

  return { load, save, generateId, getAllSets, getSet, saveSet, deleteSet, saveProgress, getProgress };
})();
