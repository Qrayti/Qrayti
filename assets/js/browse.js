/* =====================================================================
 * QRAYTI.MA - BROWSE PAGE LOGIC
 * traversal: SEM -> FILIERE -> MODULE -> TYPE
 * ===================================================================== */

let allDocuments = [];
let currentState = {
  level: 'sem', // sem, fil, mod, type, files
  sem: null,
  fil: null,
  mod: null,
  type: null
};

// ── 1. INITIALIZATION ──
window.showPage = function () {
  fetchCSV(function (csvText) {
    if (!csvText) {
      console.error("No CSV data received.");
      return;
    }
    allDocuments = parseCSV(csvText);
    renderCurrentLevel();
  });
};

function normalizeType(t) {
  const type = (t || '').trim().toUpperCase();
  if (type.includes('TD')) return 'TDS';
  if (type.includes('TP')) return 'TPS';
  if (type.includes('EXAM')) return 'EXAMS';
  return 'COURS';
}

function typeLabel(t) {
  return { COURS: 'Cours', TDS: 'TDs', TPS: 'TPs', EXAMS: 'Exams' }[t] || t;
}

function typeIcon(t) {
  return { COURS: '📘', TDS: '✏️', TPS: '🔬', EXAMS: '📝' }[t] || '📄';
}

// ── 3. RENDERING ENGINE ──
function renderCurrentLevel() {
  const grid = document.getElementById('browseGrid');
  const filesArea = document.getElementById('filesArea');

  if (!grid || !filesArea) return;

  grid.innerHTML = '';
  grid.style.display = 'grid';
  filesArea.style.display = 'none';

  updateBreadcrumbs();

  if (currentState.level === 'sem') {
    const sems = [...new Set(allDocuments.map(d => d.semestre))].filter(Boolean).sort();
    sems.forEach((s, i) => {
      const count = allDocuments.filter(d => d.semestre === s).length;
      grid.appendChild(createCard('📅', s, `${count} ${count > 1 ? t('file_plural') : t('file_singular')}`, i, () => {
        currentState.level = 'fil';
        currentState.sem = s;
        renderCurrentLevel();
      }));
    });

  } else if (currentState.level === 'fil') {
    const fils = [...new Set(allDocuments.filter(d => d.semestre === currentState.sem).map(d => d.filiere))].filter(Boolean).sort();
    fils.forEach((f, i) => {
      const count = allDocuments.filter(d => d.semestre === currentState.sem && d.filiere === f).length;
      grid.appendChild(createCard('🎓', f, `${count} ${count > 1 ? t('file_plural') : t('file_singular')}`, i, () => {
        currentState.level = 'mod';
        currentState.fil = f;
        renderCurrentLevel();
      }));
    });

  } else if (currentState.level === 'mod') {
    const mods = [...new Set(allDocuments.filter(d => d.semestre === currentState.sem && d.filiere === currentState.fil).map(d => d.module))].filter(Boolean).sort();
    mods.forEach((m, i) => {
      const count = allDocuments.filter(d => d.semestre === currentState.sem && d.filiere === currentState.fil && d.module === m).length;
      grid.appendChild(createCard('📖', m, `${count} ${count > 1 ? t('file_plural') : t('file_singular')}`, i, () => {
        currentState.level = 'type';
        currentState.mod = m;
        renderCurrentLevel();
      }));
    });

  } else if (currentState.level === 'type') {
    const types = [...new Set(allDocuments.filter(d => d.semestre === currentState.sem && d.filiere === currentState.fil && d.module === currentState.mod).map(d => normalizeType(d.type)))];
    types.forEach((tp, i) => {
      const count = allDocuments.filter(d => d.semestre === currentState.sem && d.filiere === currentState.fil && d.module === currentState.mod && normalizeType(d.type) === tp).length;
      const card = createCard(typeIcon(tp), typeLabel(tp), `${count} ${count > 1 ? t('file_plural') : t('file_singular')}`, i, () => {
        currentState.level = 'files';
        currentState.type = tp;
        renderCurrentLevel();
      });
      card.classList.add(`type-${tp.toLowerCase()}`);
      grid.appendChild(card);
    });

  } else if (currentState.level === 'files') {
    grid.style.display = 'none';
    filesArea.style.display = 'block';
    renderFiles();
  }
}

function createCard(icon, label, category, index, onClick) {
  const card = document.createElement('div');
  card.className = 'browse-card';
  card.style.animationDelay = (index * 70) + 'ms';
  card.onclick = onClick;
  card.innerHTML = `
    <div class="card-icon">${icon}</div>
    <div class="card-title">${label}</div>
    <div class="card-subtitle">${category}</div>
  `;
  return card;
}

// ── 4. FILES LIST RENDERING ──
function renderFiles() {
  const list = document.getElementById('filesList');
  const count = document.getElementById('filesCount');
  const noFiles = document.getElementById('noFiles');

  const files = allDocuments.filter(d =>
    d.semestre === currentState.sem &&
    d.filiere === currentState.fil &&
    d.module === currentState.mod &&
    normalizeType(d.type) === currentState.type
  );

  list.innerHTML = '';
  if (files.length === 0) {
    noFiles.style.display = 'block';
    count.innerHTML = '';
    return;
  }

  noFiles.style.display = 'none';
  const label = files.length > 1 ? t('file_plural') : t('file_singular');
  count.innerHTML = `${files.length} ${label} ${t('files_label')}`;

  files.forEach((f, i) => {
    let badgeClass = normalizeType(f.type);

    const item = document.createElement('a');
    item.className = 'result-item';
    item.href = '#';
    item.style.opacity = '0';
    item.style.animation = 'dropIn 0.3s ease forwards';
    item.style.animationDelay = (i * 50) + 'ms';
    item.onclick = (e) => {
      e.preventDefault();
      if (typeof openPdf === 'function') {
        openPdf(f.id, f.titre, !!f.lienURL);
      }
    };
    item.innerHTML = `
      <div class="result-left">
        <div class="result-title">${f.titre || 'Sans titre'}</div>
        <div class="result-meta">
          <span>👤 ${f.professeur || '?'}</span>
          <span class="type-badge type-${badgeClass}">${f.type || 'DOC'}</span>
        </div>
      </div>
      <div class="result-arrow">→</div>
    `;
    list.appendChild(item);
  });
}

// ── 5. BREADCRUMBS ──
function updateBreadcrumbs() {
  const bc = document.getElementById('breadcrumbs');
  if (!bc) return;

  const sep = '<span class="breadcrumb-sep">›</span>';
  let parts = [];

  // Build the levels based on current state
  parts.push({ label: t('nav_home'), lvl: 'sem' });

  if (currentState.sem) parts.push({ label: currentState.sem, lvl: 'fil' });
  if (currentState.fil) parts.push({ label: currentState.fil, lvl: 'mod' });
  if (currentState.mod) parts.push({ label: currentState.mod, lvl: 'type' });
  if (currentState.type) parts.push({ label: typeLabel(currentState.type), lvl: 'files' });

  // Map parts to buttons and join with separators
  bc.innerHTML = parts.map((p, i) => {
    const isLast = (i === parts.length - 1);
    const className = isLast ? "breadcrumb-item active" : "breadcrumb-item";
    // Only the clickable (non-last) items get the onclick event
    const action = isLast ? "" : `onclick="navigateLevel('${p.lvl}')"`;

    return `<button class="${className}" ${action}>${p.label}</button>`;
  }).join(sep);
}

window.navigateLevel = function (lvl) {
  currentState.level = lvl;
  // Reset states below the target level
  if (lvl === 'sem') { currentState.sem = null; currentState.fil = null; currentState.mod = null; currentState.type = null; }
  if (lvl === 'fil') { currentState.fil = null; currentState.mod = null; currentState.type = null; }
  if (lvl === 'mod') { currentState.mod = null; currentState.type = null; }
  if (lvl === 'type') { currentState.type = null; }
  renderCurrentLevel();
};
window.navigateLevel = function (lvl) {
  currentState.level = lvl;
  if (lvl === 'sem') { currentState.sem = null; currentState.fil = null; currentState.mod = null; currentState.type = null; }
  if (lvl === 'fil') { currentState.fil = null; currentState.mod = null; currentState.type = null; }
  if (lvl === 'mod') { currentState.mod = null; currentState.type = null; }
  if (lvl === 'type') { currentState.type = null; }
  renderCurrentLevel();
};
