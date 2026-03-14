/* =====================================================================
 * QRAYTI.MA - SHARED JAVASCRIPT
 * i18n, Theme Toggling, PDF Modals, Caching Data Fetcher, Interactivity
 * ===================================================================== */

window.QRAYTI = window.QRAYTI || {};
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzWc-1Jk1PpAmhKJZCix5r53qCCTHR1ZqaD6B-NuEKEbEFYiE7E8AsxvUcC6CNTFtLUHon4rkV5jF-/pub?gid=0&single=true&output=csv";

// ── 1. GLOBAL CSV FETCHER ──
function fetchCSV(callback) {
  const cached = sessionStorage.getItem('csv_cache');
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
      sessionStorage.setItem('csv_cache', csv);
      callback(csv);
    })
    .catch(err => {
      // General error handling if fetch fails
      const content = document.getElementById('resultsArea') || document.getElementById('browseGrid') || document.body;
      if (content) {
        content.innerHTML = '<div style="text-align:center; padding:60px; color:#ef4444; font-size:15px; background:var(--card); border:1.5px solid var(--border); border-radius:12px; margin:20px;">' +
                            '<b>Une erreur est survenue lors du chargement des données.</b><br><br>'+
                            'Vérifiez votre connexion internet ou réessayez plus tard.<br><small style="color:var(--muted);">' + err.message + '</small></div>';
      }
      console.error("Fetch CSV Failed:", err);
    });
}

/**
 * Robust CSV parser that handles quotes and maps headers to localized keys
 */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  
  // Header mapping: CSV Name -> Code Name
  const headerMap = {
    'semester': 'semestre',
    'filiere': 'filiere',
    'module': 'module',
    'professor': 'professeur',
    'type': 'type',
    'title': 'titre',
    'driveid': 'id',
    'url': 'lienURL'
  };

  const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const mappedHeaders = rawHeaders.map(h => headerMap[h] || h);

  return lines.slice(1).map(line => {
    const values = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) { values.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    values.push(cur.trim());

    const obj = {};
    mappedHeaders.forEach((h, i) => { 
      let val = (values[i] || '').replace(/^"|"$/g, '').trim();
      obj[h] = val; 
    });
    return obj;
  });
}

// ── 2. TRANSLATION (i18n) ENGINE ──
let LANGS = {};

function initThemeFromCache() {
  if(localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark');
    const b = document.getElementById('darkBtn');
    if(b) b.textContent = '☀️';
  }
}

function loadLang(lang, callback) {
  fetch('lang/' + lang + '.json?v=1')
    .then(r => r.json())
    .then(data => { 
      LANGS[lang] = data; 
      if(callback) callback(); 
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
  if(btn) btn.textContent = isDark ? '☀️' : '🌙'; 
  localStorage.setItem('theme', isDark ? 'dark' : 'light'); 
}

function toggleMobileMenu() { 
  const menu = document.getElementById('mobileMenu');
  if(menu) menu.classList.toggle('open'); 
}

function toggleLangMenu() {
  const dropdown = document.getElementById('langDropdown');
  if (dropdown) dropdown.classList.toggle('open');
}

// Close Dropdown on outside click
document.addEventListener('click', function(e) {
  const w = document.getElementById('langWrapper');
  const d = document.getElementById('langDropdown');
  if(w && d && !w.contains(e.target)) {
    d.classList.remove('open');
  }
});

function switchLang(lang) {
  applyLang(lang);
  const d = document.getElementById('langDropdown');
  if(d) d.classList.remove('open');
}


// ── 4. PDF ENGINE ──
function openPdf(id, title, isUrl = false) { 
  document.getElementById('pdfTitle').textContent = title; 
  
  const link = isUrl ? id : 'https://drive.google.com/file/d/' + id + '/view';
  const preview = isUrl ? id : 'https://drive.google.com/file/d/' + id + '/preview';
  
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
}

function closePdfDirect() { 
  const ov = document.getElementById('pdfOverlay');
  if(ov) {
    ov.classList.remove('open'); 
    document.getElementById('pdfFrame').src = ''; 
    document.body.style.overflow = ''; 
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
    if(btn) btn.textContent = '☀️'; 
  } else { 
    document.documentElement.classList.remove('dark'); 
    if(btn) btn.textContent = '🌙'; 
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
  if(hole) hole.style.cssText = `left:${cx-r}px;top:${cy-r}px;width:${r*2}px;height:${r*2}px;`;
  
  const tip = document.getElementById('langSpotlightTooltip');
  const isRtl = document.documentElement.getAttribute('dir') === 'rtl';
  
  if(tip) {
      tip.style.top = (rect.bottom + 14) + 'px';
      if(isRtl) { 
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
  if(hole) hole.style.cssText = `left:${cx-r}px;top:${cy-r}px;width:${r*2}px;height:${r*2}px;`;
  
  const tip = document.getElementById('spotlightTooltip');
  if(tip) {
      const p = tip.querySelector('p');
      const b = tip.querySelector('button');
      if(p) p.textContent = t('spotlight_theme');
      if(b) b.textContent = t('gotit');
      
      const isRtl = document.documentElement.getAttribute('dir') === 'rtl';
      tip.style.top = (rect.bottom + 14) + 'px';
      
      if(isRtl) { 
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
    window.showPage = function() {}; // Safe fallback
  }

  // First time user -> Show Language Picker, then Theme Picker
  if (!lang) {
    window.showPage();
    const lp = document.getElementById('langPickerOverlay');
    if(lp) lp.classList.add('show');
  } 
  // Returning user
  else {
    loadLang('fr', () => { // Ensure fallback French is loaded
      const continueLoad = () => {
        applyLang(lang);
        window.showPage();
        
        if (!theme) {
          const tp = document.getElementById('themePickerOverlay');
          if(tp) tp.classList.add('show');
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
