/* =====================================================================
 * QRAYTI.MA - BROWSE PAGE LOGIC
 * traversal: SEM -> FILIERE -> MODULE -> TYPE
 * ===================================================================== */

let allDocuments = [];
let currentState = {
  level: 'folder', // 'folder' or 'files' (files is used when we show the final list)
  path: [] // Array of strings representing the current folder path
};

// ── 1. INITIALIZATION ──
window.showPage = function () {
  fetchCSV(function (csvText) {
    if (!csvText) {
      console.error("No CSV data received.");
      return;
    }
    allDocuments = parseCSV(csvText);

    // Deep Linking: Handle old fixed states or new path states
    const pendingNav = sessionStorage.getItem('pending_nav');
    const pendingPdf = sessionStorage.getItem('pending_pdf');

    if (pendingNav) {
      sessionStorage.removeItem('pending_nav');
      try {
        const params = JSON.parse(pendingNav);
        // Compatibility: If chatbot sends old {sem, fil, mod}, map it to path
        if (!params.path && params.sem) {
          params.path = [params.sem];
          if (params.fil) params.path.push(params.fil);
          if (params.mod) params.path.push(params.mod);
          if (params.type) params.path.push(params.type);
        }
        Object.assign(currentState, params);
      } catch (e) { console.error("Invalid pending_nav state"); }
    }

    renderCurrentLevel();

    // Auto-open PDF if requested
    if (pendingPdf) {
      sessionStorage.removeItem('pending_pdf');
      try {
        const pdf = JSON.parse(pendingPdf);
        setTimeout(() => {
          if (typeof openPdf === 'function') openPdf(pdf.id, pdf.titre, pdf.isUrl);
        }, 500);
      } catch (e) { console.error("Invalid pending_pdf state"); }
    }
  });
};

// ── 3. RENDERING ENGINE ──
function renderCurrentLevel() {
  const grid = document.getElementById('browseGrid');
  const filesArea = document.getElementById('filesArea');

  if (!grid || !filesArea) return;

  grid.innerHTML = '';
  grid.style.display = 'grid';
  filesArea.style.display = 'none';

  updateBreadcrumbs();

  const currentPath = currentState.path || [];
  const depth = currentPath.length;

  // Filter documents that belong to this branch
  const branchDocs = allDocuments.filter(d => {
    return currentPath.every((p, i) => d.path[i] === p);
  });

  // IDENTIFY SUBFOLDERS
  const subfolderMap = new Map(); // Name -> Count
  const filesInCurrentFolder = [];

  branchDocs.forEach(d => {
    if (d.path.length > depth) {
      const folderName = d.path[depth];
      subfolderMap.set(folderName, (subfolderMap.get(folderName) || 0) + 1);
    } else {
      filesInCurrentFolder.push(d);
    }
  });

  // RENDER FOLDERS
  const folders = Array.from(subfolderMap.keys()).sort();
  folders.forEach((f, i) => {
    const totalInFolder = branchDocs.filter(d => d.path[depth] === f).length;
    let icon = '📁';
    // Visual candy: Use specific icons for first level if they look like S1, S2...
    if (depth === 0 && (f.startsWith('S') || f.startsWith('s'))) icon = '📅';

    grid.appendChild(createCard(icon, f, `${totalInFolder} ${totalInFolder > 1 ? t('file_plural') : t('file_singular')}`, i, () => {
      navigateLevel({ path: [...currentPath, f] });
    }));
  });

  // IF NO SUBFOLDERS: Show Files
  if (folders.length === 0 || currentState.level === 'files') {
    grid.style.display = 'none';
    filesArea.style.display = 'block';
    renderFiles(branchDocs); // Use branchDocs or filesInCurrentFolder depending on UX preference
    // User probably wants the list of files in the current leaf
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
function renderFiles(files) {
  const list = document.getElementById('filesList');
  const count = document.getElementById('filesCount');
  const noFiles = document.getElementById('noFiles');

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
        openPdf(f.id, f.titre, String(f.id).startsWith('http'));
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

  parts.push({ label: t('nav_home'), path: [] });

  let cumulativePath = [];
  currentState.path.forEach(p => {
    cumulativePath.push(p);
    parts.push({ label: p, path: [...cumulativePath] });
  });

  bc.innerHTML = parts.map((p, i) => {
    const isLast = (i === parts.length - 1);
    const className = isLast ? "breadcrumb-item active" : "breadcrumb-item";
    const action = isLast ? "" : `onclick="navigateLevel({ path: ${JSON.stringify(p.path).replace(/"/g, "'")}, jump: true })"`;
    return `<button class="${className}" ${action}>${p.label}</button>`;
  }).join(sep);
}

// --- Navigation Logic ---
window.navigateLevel = function (params, isPopState = false) {
  // Apply new parameters
  Object.assign(currentState, params);
  
  // History management
  if (!isPopState) {
    const stateCopy = JSON.parse(JSON.stringify(currentState));
    history.pushState({ state: stateCopy }, "", "");
  }
  
  renderCurrentLevel();
};

window.addEventListener('popstate', (event) => {
  if (event.state && event.state.state) {
    currentState = JSON.parse(JSON.stringify(event.state.state));
    renderCurrentLevel();
  } else {
    window.location.reload(); 
  }
});

// Force-init history state on startup
(function initHistory() {
  const initialState = JSON.parse(JSON.stringify(currentState));
  history.replaceState({ state: initialState }, "", "");
})();
