'use strict';

// ── Constants ──────────────────────────────────────────────────────────────

const API_URL = '/.netlify/functions/discover';

const GENRE_MAP = {
  28: 'Azione', 12: 'Avventura', 16: 'Animazione', 35: 'Commedia',
  80: 'Crime', 99: 'Documentario', 18: 'Dramma', 10751: 'Famiglia',
  14: 'Fantasy', 36: 'Storia', 27: 'Horror', 10402: 'Musica',
  9648: 'Mistero', 10749: 'Romantico', 878: 'Fantascienza',
  53: 'Thriller', 10752: 'Guerra', 37: 'Western',
  10759: 'Azione/Avventura', 10765: 'Sci-Fi/Fantasy',
  10768: 'Guerra/Politica',
};

const LANG_FLAGS = {
  it:'🇮🇹', en:'🇺🇸', fr:'🇫🇷', de:'🇩🇪', es:'🇪🇸',
  ja:'🇯🇵', ko:'🇰🇷', zh:'🇨🇳', pt:'🇧🇷', ru:'🇷🇺',
  da:'🇩🇰', sv:'🇸🇪', no:'🇳🇴', fi:'🇫🇮', pl:'🇵🇱',
  nl:'🇳🇱', tr:'🇹🇷', ar:'🇸🇦', hi:'🇮🇳', th:'🇹🇭',
};

const SECTIONS = ['hero-section', 'loading-section', 'error-section', 'results-section'];

// ── Tag-input state ────────────────────────────────────────────────────────

let tags = [];

function addTag(title) {
  const clean = title.trim().replace(/\s+/g, ' ');
  if (!clean || tags.includes(clean) || tags.length >= 3) return;
  tags.push(clean);
  renderTags();
}

function removeTag(index) {
  tags.splice(index, 1);
  renderTags();
}

function renderTags() {
  const container  = document.getElementById('tags');
  const refInput   = document.getElementById('referenceInput');

  container.innerHTML = tags.map((t, i) => `
    <span class="tag">
      ${escHtml(t)}
      <button type="button" class="tag-remove" data-index="${i}" aria-label="Rimuovi ${escAttr(t)}">×</button>
    </span>
  `).join('');

  const full = tags.length >= 3;
  refInput.disabled     = full;
  refInput.placeholder  = full
    ? 'Massimo 3 titoli raggiunto'
    : tags.length > 0
      ? 'Aggiungi un altro titolo…'
      : 'Scrivi un titolo e premi Invio…';
}

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const refInput  = document.getElementById('referenceInput');
  const tagWrapper = document.getElementById('tagWrapper');

  // Tag: Enter key adds tag
  refInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = refInput.value.trim();
      if (val) { addTag(val); refInput.value = ''; }
    }
    // Backspace on empty removes last tag
    if (e.key === 'Backspace' && !refInput.value && tags.length) {
      removeTag(tags.length - 1);
    }
  });

  // Tag: blur adds pending text
  refInput.addEventListener('blur', () => {
    const val = refInput.value.trim();
    if (val) { addTag(val); refInput.value = ''; }
  });

  // Tag wrapper click focuses input or removes tag
  tagWrapper.addEventListener('click', e => {
    const btn = e.target.closest('.tag-remove');
    if (btn) { removeTag(parseInt(btn.dataset.index, 10)); }
    else { refInput.focus(); }
  });

  // Form submit
  document.getElementById('searchForm').addEventListener('submit', handleSearch);

  // Navigation buttons
  document.getElementById('newSearchBtn').addEventListener('click',  resetToSearch);
  document.getElementById('newSearchBtn2').addEventListener('click', resetToSearch);
  document.getElementById('retryBtn').addEventListener('click',      handleRetry);

  // Copy buttons (event delegation)
  document.addEventListener('click', handleCopyClick);
});

// ── Search flow ────────────────────────────────────────────────────────────

let lastPayload = null;

async function handleSearch(e) {
  e.preventDefault();

  // Flush any pending text in the tag input
  const refInput = document.getElementById('referenceInput');
  const pending  = refInput.value.trim();
  if (pending) { addTag(pending); refInput.value = ''; }

  if (!tags.length) {
    refInput.style.borderColor = '#E50914';
    refInput.focus();
    setTimeout(() => { refInput.style.borderColor = ''; }, 2000);
    return;
  }

  const payload = {
    reference_films: [...tags],
    mood:     document.getElementById('mood').value.trim(),
    avoid:    document.getElementById('avoid').value.trim(),
    language: document.getElementById('language').value.trim(),
  };
  lastPayload = payload;

  showSection('loading');
  document.getElementById('searchBtn').disabled = true;

  try {
    const res  = await fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error ?? `Errore HTTP ${res.status}`);
    if (!data.films?.length && !data.series?.length) {
      throw new Error('Nessun risultato trovato. Prova con titoli diversi.');
    }

    renderResults(data, payload.reference_films);
    showSection('results');
    window.scrollTo({ top: 0, behavior: 'instant' });

  } catch (err) {
    showError(err.message ?? 'Errore imprevisto. Riprova.');
  } finally {
    document.getElementById('searchBtn').disabled = false;
  }
}

function handleRetry() {
  if (lastPayload) {
    document.getElementById('searchForm').dispatchEvent(new Event('submit'));
  } else {
    showSection('search');
  }
}

// ── Render ─────────────────────────────────────────────────────────────────

function renderResults(data, refFilms) {
  document.getElementById('refFilmsLabel').textContent = refFilms.join(', ');
  renderGrid(data.films   ?? [], document.getElementById('filmsGrid'));
  renderGrid(data.series  ?? [], document.getElementById('seriesGrid'));
}

function renderGrid(cards, container) {
  if (!cards.length) {
    container.innerHTML = '<p class="no-results">Nessun titolo trovato per questa categoria.</p>';
    return;
  }
  container.innerHTML = cards.map((card, i) => renderCard(card, i)).join('');
}

function renderCard(card, index) {
  const genres = (card.genre_ids ?? [])
    .map(id => GENRE_MAP[id])
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ');

  const flag    = LANG_FLAGS[card.original_language] ?? '🌍';
  const votes   = card.vote_count   ? card.vote_count.toLocaleString('it-IT') : '?';
  const rating  = card.vote_average ? card.vote_average.toFixed(1) : '?';
  const year    = card.year ?? '?';
  const delay   = (index * 0.12).toFixed(2);

  const posterHtml = card.poster_url
    ? `<img
        src="${escAttr(card.poster_url)}"
        alt="${escAttr(card.title)}"
        loading="lazy"
        onload="this.classList.add('loaded')"
        onerror="this.replaceWith(makePlaceholder())"
      />`
    : `<div class="poster-placeholder"></div>`;

  const providers = renderProviders(card.watch_providers);

  return `
<article class="film-card" style="animation-delay:${delay}s" data-id="${card.tmdb_id}">
  <div class="card-poster">
    ${posterHtml}
    <div class="poster-overlay">
      <span class="overlay-genres">${escHtml(genres || 'Cinema')}</span>
    </div>
    <div class="card-badge">★ ${rating}</div>
    <button class="copy-btn" type="button"
            data-copy="${escAttr(card.title)}"
            title="Copia titolo" aria-label="Copia titolo">
      ${iconCopy()}
    </button>
  </div>
  <div class="card-body">
    <h3 class="card-title">${escHtml(card.title)}</h3>
    <p class="card-meta">${year} · ${flag} · ${votes} voti</p>

    <details class="card-detail" open>
      <summary>Perché è una gemma nascosta</summary>
      <p>${escHtml(card.perche_sconosciuto)}</p>
    </details>

    <details class="card-detail" open>
      <summary>Perché guardarlo</summary>
      <p>${escHtml(card.perche_consigliato)}</p>
    </details>

    <details class="card-detail">
      <summary>Cosa ne dice il pubblico</summary>
      <p>${escHtml(card.sintesi_recensioni)}</p>
    </details>

    <div class="card-providers">
      <div class="providers-label">Dove vederlo in Italia</div>
      ${providers}
    </div>
  </div>
</article>`;
}

function renderProviders(wp) {
  const it  = wp?.IT ?? wp ?? {};
  const all = [...(it.flatrate ?? []), ...(it.rent ?? [])];
  if (!all.length) return '<p class="no-providers">Non disponibile in streaming</p>';

  const logos = all.slice(0, 6).map(p => `
    <img
      src="https://image.tmdb.org/t/p/w45${p.logo_path}"
      alt="${escAttr(p.provider_name)}"
      title="${escAttr(p.provider_name)}"
      class="provider-logo"
      loading="lazy"
    />`).join('');

  return `<div class="providers-icons">${logos}</div>`;
}

// ── Copy button ────────────────────────────────────────────────────────────

function handleCopyClick(e) {
  const btn = e.target.closest('.copy-btn');
  if (!btn) return;

  const text = btn.dataset.copy;
  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('copied');
    btn.innerHTML = iconCheck();
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = iconCopy();
    }, 2000);
  }).catch(() => {
    // Fallback for older browsers
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  });
}

// ── Section state machine ──────────────────────────────────────────────────

function showSection(name) {
  const id = {
    search:  'hero-section',
    loading: 'loading-section',
    error:   'error-section',
    results: 'results-section',
  }[name];
  SECTIONS.forEach(s => { document.getElementById(s).hidden = s !== id; });
}

function showError(msg) {
  document.getElementById('errorMsg').textContent = msg;
  showSection('error');
}

function resetToSearch() {
  tags = [];
  renderTags();
  ['mood','avoid','language'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('referenceInput').value = '';
  showSection('search');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ── SVG icons ──────────────────────────────────────────────────────────────

function iconCopy() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>`;
}

function iconCheck() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`;
}

// ── Utilities ──────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Exposed globally so onerror inline handler can call it
window.makePlaceholder = function () {
  const d = document.createElement('div');
  d.className = 'poster-placeholder';
  return d;
};
