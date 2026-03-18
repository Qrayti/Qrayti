/* =====================================================================
 * QRAYTI.MA - SHARED JAVASCRIPT
 * i18n, Theme Toggling, PDF Modals, Caching Data Fetcher, Interactivity
 * ===================================================================== */

window.QRAYTI = window.QRAYTI || {};
window.QRAYTI.activeFileId = null; // Track currently open PDF
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzWc-1Jk1PpAmhKJZCix5r53qCCTHR1ZqaD6B-NuEKEbEFYiE7E8AsxvUcC6CNTFtLUHon4rkV5jF-/pub?gid=0&single=true&output=csv";

// Cache version — bump this whenever the sheet structure changes
const CSV_CACHE_KEY = 'csv_cache_v4';

// ── 1. GLOBAL CSV FETCHER ──
function fetchCSV(callback) {
  const cached = sessionStorage.getItem(CSV_CACHE_KEY);
  if (cached) {
    callback(cached);
    return;
  }

  fetch(CSV_URL)
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    })
    .then(csv => {
      sessionStorage.setItem(CSV_CACHE_KEY, csv);
      callback(csv);
    })
    .catch(err => {
      // General error handling if fetch fails
      const content = document.getElementById('resultsArea') || document.getElementById('browseGrid') || document.body;
      if (content) {
        content.innerHTML = '<div style="text-align:center; padding:60px; color:#ef4444; font-size:15px; background:var(--card); border:1.5px solid var(--border); border-radius:12px; margin:20px;">' +
          '<b>Une erreur est survenue lors du chargement des données.</b><br><br>' +
          'Vérifiez votre connexion internet ou réessayez plus tard.<br><small style="color:var(--muted);">' + err.message + '</small></div>';
      }
      console.error("Fetch CSV Failed:", err);
    });
}

/**
 * ROBUST character-by-character CSV Parser.
 */
function parseCSV(text) {
  if (!text) return [];

  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"'; // Escaped quote
          i++;
        } else {
          inQuotes = false; // End of quotes
        }
      } else {
        currentCell += char; // Append everything inside quotes
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        if (currentRow.length < 9) currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        if (currentRow.length < 9) currentRow.push(currentCell.trim());
        if (currentRow.length > 0) rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        if (char === '\r') i++;
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell || currentRow.length > 0) {
    if (currentRow.length < 9) currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  if (rows.length < 2) return [];

  return rows.slice(1).map(row => {
    const titre = (row[6] || '').replace(/^"|"$/g, '').trim();
    const id = (row[7] || '').replace(/^"|"$/g, '').trim();
    if (!titre && !id) return null;

    let preType = normalizeType(row[5]);
    if (id.includes('youtu') || preType === 'VIDEOS') preType = 'VIDEOS';

    return {
      filiere: (row[1] || '').replace(/^"|"$/g, '').trim(),
      semestre: (row[2] || '').replace(/^"|"$/g, '').trim(),
      module: (row[3] || '').replace(/^"|"$/g, '').trim(),
      professeur: (row[4] || '').replace(/^"|"$/g, '').trim(),
      type: preType,
      titre: titre,
      id: id,
      description: (row[8] || '').replace(/^"|"$/g, '').trim()
    };
  }).filter(Boolean);
}

function detectItemType(r) {
  return r && r.type ? r.type : 'OTHER';
}

function normalizeType(t) {
  if (!t) return 'OTHER';
  const raw = String(t).trim();
  const up = raw.toUpperCase();

  if (up.includes('TD')) return 'TD';
  if (up.includes('TP')) return 'TP';
  if (up.includes('COURS')) return 'COURS';
  if (up.includes('VIDEO')) return 'VIDEOS';
  if (up.includes('EXAM')) return 'EXAM';

  const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes('resume')) return 'Résumé';

  return 'OTHER';
}


function typeLabel(t) {
  return t;
}

function typeIcon(t) {
  const icons = {
    'VIDEOS': '🎬',
    'TD': '✏️',
    'TP': '🔬',
    'EXAM': '📝',
    'Résumé': '📋',
    'COURS': '📚',
    'OTHER': '📄'
  };
  return icons[t] || '📄';
}

// ── 2. TRANSLATION (i18n) ENGINE ──
let LANGS = {};

function initThemeFromCache() {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark');
    const b = document.getElementById('darkBtn');
    if (b) b.textContent = '☀️';
  }
}

function loadLang(lang, callback) {
  fetch('lang/' + lang + '.json?v=1')
    .then(r => r.json())
    .then(data => {
      LANGS[lang] = data;
      if (callback) callback();
    })
    .catch(err => {
      console.warn("Could not load translation " + lang, err);
      // Fallback: If it's not FR and it fails, just trigger callback to render what we have
      if (callback) callback();
      else if (typeof window.showPage === 'function') window.showPage();
    });
}

function t(key) {
  const l = localStorage.getItem('lang') || 'fr';
  return (LANGS[l] && LANGS[l][key] && LANGS[l][key] !== "")
    ? LANGS[l][key]
    : ((LANGS['fr'] && LANGS['fr'][key]) ? LANGS['fr'][key] : key);
}

function renderI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = t(k);
    } else {
      el.innerHTML = t(k);
    }
  });

  document.documentElement.classList.remove('pre-lang');

  // If the specific page script has a rerender hook to update data DOM
  if (typeof window.rerender === 'function') window.rerender();
}

function applyLang(lang) {
  localStorage.setItem('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', lang);

  const flags = { fr: '🇫🇷', en: '🇬🇧', ar: '🇲🇦' };
  const lb = document.getElementById('langBtn');
  if (lb) lb.textContent = flags[lang] || '🇫🇷';

  if (!LANGS[lang]) {
    loadLang(lang, () => renderI18n());
  } else {
    renderI18n();
  }
}


// ── 3. INTERFACE CONTROLS ──
function toggleDark() {
  const isDark = document.documentElement.classList.toggle('dark');
  const btn = document.getElementById('darkBtn');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  if (menu) menu.classList.toggle('open');
}

function toggleLangMenu() {
  const dropdown = document.getElementById('langDropdown');
  if (dropdown) dropdown.classList.toggle('open');
}

// Close Dropdown on outside click
document.addEventListener('click', function (e) {
  const w = document.getElementById('langWrapper');
  const d = document.getElementById('langDropdown');
  if (w && d && !w.contains(e.target)) {
    d.classList.remove('open');
  }
});

function switchLang(lang) {
  applyLang(lang);
  const d = document.getElementById('langDropdown');
  if (d) d.classList.remove('open');
}


// ── 4. PDF ENGINE ──
function openPdf(id, title, isUrl = false) {
  document.getElementById('pdfTitle').textContent = title;

  let link = isUrl ? id : 'https://drive.google.com/file/d/' + id + '/view';
  let preview = isUrl ? id : 'https://drive.google.com/file/d/' + id + '/preview';

  // High-Performance Video Detection
  const isVideo = isUrl ? (id.includes('youtube.com') || id.includes('youtu.be')) : (detectItemType({ type: 'VIDEO' }) === 'VIDEOS');

  // YouTube Smart Conversion
  if (isUrl && (id.includes('youtube.com') || id.includes('youtu.be'))) {
    const videoId = id.includes('v=') ? id.split('v=')[1].split('&')[0] : id.split('/').pop();
    preview = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
  }
  // Google Drive Direct Video Stream (Fastest)
  else if (!isUrl && detectItemType({ titre: title, type: '' }) === 'VIDEOS') {
    preview = `https://drive.google.com/file/d/${id}/preview?resourcekey&autoplay=1`;
  }

  document.getElementById('pdfOpenLink').href = link;
  document.getElementById('pdfLoading').style.display = 'flex';
  document.getElementById('pdfFrame').style.display = 'none';
  document.getElementById('pdfFrame').src = preview;
  document.getElementById('pdfFrame').onload = () => {
    document.getElementById('pdfLoading').style.display = 'none';
    document.getElementById('pdfFrame').style.display = 'block';
  };
  document.getElementById('pdfOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  window.QRAYTI.activeFileId = id; // Update active file
}

function closePdfDirect() {
  const ov = document.getElementById('pdfOverlay');
  if (ov) {
    ov.classList.remove('open');
    document.getElementById('pdfFrame').src = '';
    document.body.style.overflow = '';
    window.QRAYTI.activeFileId = null; // Reset active file
  }
}

function closePdf(e) {
  if (e.target === document.getElementById('pdfOverlay')) closePdfDirect();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closePdfDirect();
});


// ── 5. ONBOARDING & COACHMARKS ──
function pickLang(lang) {
  applyLang(lang);
  document.getElementById('langPickerOverlay').classList.remove('show');

  const theme = localStorage.getItem('theme');
  if (!theme) {
    setTimeout(() => document.getElementById('themePickerOverlay').classList.add('show'), 350);
  } else {
    setTimeout(showLangSpotlight, 350);
  }
}

function pickTheme(theme) {
  localStorage.setItem('theme', theme);
  const btn = document.getElementById('darkBtn');
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    if (btn) btn.textContent = '☀️';
  } else {
    document.documentElement.classList.remove('dark');
    if (btn) btn.textContent = '🌙';
  }

  document.getElementById('themePickerOverlay').classList.remove('show');
  setTimeout(showLangSpotlight, 350);
}

function showLangSpotlight() {
  const btn = document.getElementById('langBtn');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const r = Math.max(rect.width, rect.height) / 2 + 12;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const hole = document.getElementById('langSpotlightHole');
  if (hole) hole.style.cssText = `left:${cx - r}px;top:${cy - r}px;width:${r * 2}px;height:${r * 2}px;`;

  const tip = document.getElementById('langSpotlightTooltip');
  const isRtl = document.documentElement.getAttribute('dir') === 'rtl';

  if (tip) {
    tip.style.top = (rect.bottom + 14) + 'px';
    if (isRtl) {
      tip.style.left = (rect.left - 4) + 'px'; tip.style.right = 'auto';
    } else {
      tip.style.right = (window.innerWidth - rect.right - 4) + 'px'; tip.style.left = 'auto';
    }
  }
  document.getElementById('langSpotlightOverlay').classList.add('show');
  applyLang(localStorage.getItem('lang') || 'fr');
}

function dismissLangSpotlight() {
  document.getElementById('langSpotlightOverlay').classList.remove('show');
  setTimeout(showThemeSpotlight, 300);
}

function showThemeSpotlight() {
  const btn = document.getElementById('darkBtn');
  if (!btn) return;

  const rect = btn.getBoundingClientRect();
  const r = Math.max(rect.width, rect.height) / 2 + 12;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const hole = document.getElementById('spotlightHole');
  if (hole) hole.style.cssText = `left:${cx - r}px;top:${cy - r}px;width:${r * 2}px;height:${r * 2}px;`;

  const tip = document.getElementById('spotlightTooltip');
  if (tip) {
    const p = tip.querySelector('p');
    const b = tip.querySelector('button');
    if (p) p.textContent = t('spotlight_theme');
    if (b) b.textContent = t('gotit');

    const isRtl = document.documentElement.getAttribute('dir') === 'rtl';
    tip.style.top = (rect.bottom + 14) + 'px';

    if (isRtl) {
      tip.style.left = (rect.left - 4) + 'px'; tip.style.right = 'auto';
    } else {
      tip.style.right = (window.innerWidth - rect.right - 4) + 'px'; tip.style.left = 'auto';
    }
  }
  document.getElementById('spotlightOverlay').classList.add('show');
}

function dismissSpotlight() {
  document.getElementById('spotlightOverlay').classList.remove('show');
  localStorage.setItem('onboarded', '1');
}

// ── 6. BOOTSTRAP ──
window.addEventListener('DOMContentLoaded', () => {
  initThemeFromCache();

  const lang = localStorage.getItem('lang');
  const theme = localStorage.getItem('theme');
  const onboarded = localStorage.getItem('onboarded');

  if (!window.showPage) {
    window.showPage = function () { }; // Safe fallback
  }

  // First time user -> Show Language Picker, then Theme Picker
  if (!lang) {
    window.showPage();
    const lp = document.getElementById('langPickerOverlay');
    if (lp) lp.classList.add('show');
  }
  // Returning user
  else {
    loadLang('fr', () => { // Ensure fallback French is loaded
      const continueLoad = () => {
        applyLang(lang);
        window.showPage();

        if (!theme) {
          const tp = document.getElementById('themePickerOverlay');
          if (tp) tp.classList.add('show');
        } else if (!onboarded) {
          if (!sessionStorage.getItem('spotlight_shown')) {
            sessionStorage.setItem('spotlight_shown', '1');
            setTimeout(showLangSpotlight, 400);
          }
        }
      };

      if (lang !== 'fr') {
        loadLang(lang, continueLoad);
      } else {
        continueLoad();
      }
    });
  }
});
