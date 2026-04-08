(() => {
  let pendingDeleteId = null;

  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.hidden = true; }, 3000);
  }

  function formatDate(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function renderSetList() {
    const sets = Storage.getAllSets();
    const list = document.getElementById('sets-list');
    const empty = document.getElementById('empty-state');

    if (sets.length === 0) {
      list.innerHTML = '';
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    list.innerHTML = '';

    for (const set of sets) {
      const progress = Storage.getProgress(set.id);
      const stats = SM2.getStats(set.cards || [], progress);
      const pct = stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0;

      const card = document.createElement('div');
      card.className = 'set-card';
      card.innerHTML = `
        <div class="set-card-info">
          <div class="set-card-header">
            <div>
              <div class="set-card-title">${escapeHtml(set.name)}</div>
              <div class="set-card-meta">${stats.total} cards &middot; Updated ${formatDate(set.updatedAt)}</div>
            </div>
            <div class="set-card-badges">
              ${stats.due > 0 ? `<span class="badge badge-due">${stats.due} due</span>` : ''}
              ${pct === 100 ? `<span class="badge badge-done">Complete</span>` : ''}
            </div>
          </div>
          <div class="progress-wrap">
            <div class="progress-label">${stats.learned}/${stats.total} learned (${pct}%)</div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width:${pct}%"></div>
            </div>
          </div>
        </div>
        <div class="set-card-actions">
          <a href="study.html?id=${encodeURIComponent(set.id)}" class="btn btn-primary btn-sm">Study</a>
          <a href="edit.html?id=${encodeURIComponent(set.id)}" class="btn btn-ghost btn-sm">Edit</a>
          <button class="btn btn-outline-danger btn-sm btn-delete" data-id="${escapeHtml(set.id)}">Delete</button>
        </div>
      `;
      list.appendChild(card);
    }

    list.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => openDeleteModal(btn.dataset.id));
    });
  }

  function openDeleteModal(id) {
    pendingDeleteId = id;
    document.getElementById('modal-confirm').hidden = false;
  }

  function closeDeleteModal() {
    pendingDeleteId = null;
    document.getElementById('modal-confirm').hidden = true;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderSetList();

    document.getElementById('btn-new-set').addEventListener('click', () => {
      window.location.href = 'edit.html';
    });

    const btnNewSetEmpty = document.getElementById('btn-new-set-empty');
    if (btnNewSetEmpty) {
      btnNewSetEmpty.addEventListener('click', () => { window.location.href = 'edit.html'; });
    }

    document.getElementById('modal-cancel').addEventListener('click', closeDeleteModal);

    document.getElementById('modal-confirm-btn').addEventListener('click', () => {
      if (pendingDeleteId) {
        Storage.deleteSet(pendingDeleteId);
        closeDeleteModal();
        renderSetList();
        showToast('Card set deleted.');
      }
    });

    document.getElementById('modal-confirm').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeDeleteModal();
    });
  });
})();
