/* =====================================================================
 * QRAYTI.MA - INDEX PAGE LOGIC
 * Instantly applies filters, syncs inline vs side panel, floating button
 * ===================================================================== */

let globalData = [];

window.showPage = function() {
  fetchCSV(function(csvText) {
    if (!csvText || typeof csvText !== 'string') return;
    globalData = parseCSV(csvText);
    populateFilters(globalData);
  });

  // Setup live search bindings
  const input = document.getElementById('searchInput');
  if (input) {
    input.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') performSearch();
    });
    let timeout = null;
    input.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (input.value.trim().length > 0 || input.value.trim() === '') performSearch();
      }, 400);
    });
  }

  // Setup Instant Filter Application + Sync
  setupFilterSyncAndInstantSearch('filterSemestre', 'sideFilterSemestre');
  setupFilterSyncAndInstantSearch('filterFiliere', 'sideFilterFiliere');
  setupFilterSyncAndInstantSearch('filterType', 'sideFilterType');

  // Setup Scroll listener for floating filter button
  window.addEventListener('scroll', () => {
    const floatBtn = document.getElementById('floatFilterBtn');
    if (!floatBtn) return;
    // Show after scrolling past 200px
    if (window.scrollY > 200) {
      floatBtn.classList.add('visible');
    } else {
      floatBtn.classList.remove('visible');
    }
  });
};

function setupFilterSyncAndInstantSearch(inlineId, sideId) {
  const inlineEl = document.getElementById(inlineId);
  const sideEl = document.getElementById(sideId);

  if (inlineEl) {
    inlineEl.addEventListener('change', (e) => {
      if (sideEl) sideEl.value = e.target.value; // Sync to side
      performSearch(); // Apply instantly
    });
  }
  
  if (sideEl) {
    sideEl.addEventListener('change', (e) => {
      if (inlineEl) inlineEl.value = e.target.value; // Sync to inline
      performSearch(); // Apply instantly
    });
  }
}

window.toggleFilters = function() {
  const btn = document.getElementById('filterToggleBtn');
  const panel = document.getElementById('searchFilters');
  if (!panel || !btn) return;
  panel.classList.toggle('visible');
  btn.classList.toggle('active');
};

// Side Panel Controls
window.openSideFilters = function() {
  document.getElementById('sideFilterOverlay').classList.add('open');
  document.getElementById('sideFilterPanel').classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.closeSideFilters = function() {
  document.getElementById('sideFilterOverlay').classList.remove('open');
  document.getElementById('sideFilterPanel').classList.remove('open');
  document.body.style.overflow = '';
};

function populateFilters(data) {
  const semsSet = new Set();
  const filSet = new Set();

  data.forEach(r => {
    if (r.semestre) semsSet.add(r.semestre.trim());
    if (r.filiere)  filSet.add(r.filiere.trim());
  });

  const semSelect = document.getElementById('filterSemestre');
  const filSelect = document.getElementById('filterFiliere');
  const sideSemSelect = document.getElementById('sideFilterSemestre');
  const sideFilSelect = document.getElementById('sideFilterFiliere');

  const createOpt = val => {
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = val;
    return opt;
  };

  [...semsSet].sort().forEach(s => {
    if(semSelect) semSelect.appendChild(createOpt(s));
    if(sideSemSelect) sideSemSelect.appendChild(createOpt(s));
  });

  [...filSet].sort().forEach(f => {
    if(filSelect) filSelect.appendChild(createOpt(f));
    if(sideFilSelect) sideFilSelect.appendChild(createOpt(f));
  });
}

window.performSearch = function() {
  const q = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  // Read from inline filters (they are synced)
  const fSem = document.getElementById('filterSemestre').value;
  const fFil = document.getElementById('filterFiliere').value;
  const fTyp = document.getElementById('filterType').value;

  const resultsArea = document.getElementById('resultsArea');
  const list = document.getElementById('resultsList');
  const noRes = document.getElementById('noResults');
  const countLabel = document.getElementById('resultsCount');

  // If entirely empty parameters, hide results and show Browse
  if (!q && !fSem && !fFil && !fTyp) {
    resultsArea.classList.remove('active');
    document.getElementById('browseSection').style.display = 'block';
    document.getElementById('browseDivider').style.display = 'flex';
    return;
  }

  // Filter Data
  const filtered = globalData.filter(r => {
    const matchSem = !fSem || r.semestre === fSem;
    const matchFil = !fFil || r.filiere === fFil;
    let matchTyp = true;
    if (fTyp) matchTyp = (r.type || '').toUpperCase().includes(fTyp);

    let matchQ = true;
    if (q) {
      const title = (r.titre || '').toLowerCase();
      const mod = (r.module || '').toLowerCase();
      const prof = (r.professeur || '').toLowerCase();
      matchQ = title.includes(q) || mod.includes(q) || prof.includes(q);
    }

    return matchSem && matchFil && matchTyp && matchQ;
  });

  // Render Logic
  resultsArea.classList.add('active');
  document.getElementById('browseSection').style.display = 'none';
  document.getElementById('browseDivider').style.display = 'none';
  list.innerHTML = '';

  if (filtered.length === 0) {
    noRes.style.display = 'block';
    countLabel.textContent = '';
  } else {
    noRes.style.display = 'none';
    const single = window.t ? window.t('file_singular') : 'fichier';
    const plural = window.t ? window.t('file_plural') : 'fichiers';
    const txt = filtered.length === 1 ? single : plural;
    countLabel.textContent = `${filtered.length} ${txt}`;

    filtered.forEach(r => {
      let badgeClass = 'COURS';
      const upperType = (r.type || '').toUpperCase();
      if(upperType.includes('TD')) badgeClass = 'TDS';
      else if(upperType.includes('TP')) badgeClass = 'TPS';
      else if(upperType.includes('EXAM')) badgeClass = 'EXAMS';

      const item = document.createElement('a');
      item.className = 'result-item';
      item.href = '#';
      item.onclick = (e) => { e.preventDefault(); openPdf(r.id, r.titre, !!r.lienURL); };

      item.innerHTML = `
        <div class="result-left">
          <div class="result-title">${r.titre || 'Sans titre'}</div>
          <div class="result-meta">
            <span>${r.module || '?'}</span>
            • <span>${r.professeur || '?'}</span>
            <span class="type-badge type-${badgeClass}">${r.type || 'DOC'}</span>
          </div>
        </div>
        <div class="result-arrow">→</div>
      `;
      list.appendChild(item);
    });
  }
};
