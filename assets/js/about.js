/* =====================================================================
 * QRAYTI.MA - ABOUT PAGE LOGIC
 * Reads raw CSV text from sessionStorage (via shared.js fetchCSV)
 * Parses it, computes stats, populates counters and filiere tags.
 * ===================================================================== */

window.showPage = function() {
  fetchCSV(function(csvText) {
    if (!csvText || typeof csvText !== 'string') return;
    const rows = parseCSV(csvText);

    // --- Compute unique stats ---
    const filieres = new Set();
    const modules  = new Set();
    const sems     = new Set();

    rows.forEach(r => {
      if (r.filiere)   filieres.add(r.filiere.trim());
      if (r.module)    modules.add(r.module.trim());
      if (r.semestre)  sems.add(r.semestre.trim());
    });

    // Animated counter helper
    function animateCount(elId, target) {
      const el = document.getElementById(elId);
      if (!el) return;
      let cur = 0;
      const duration = 900;
      const step = Math.max(1, Math.ceil(target / (duration / 16)));
      const timer = setInterval(() => {
        cur = Math.min(cur + step, target);
        el.textContent = cur.toLocaleString('fr-FR');
        if (cur >= target) clearInterval(timer);
      }, 16);
    }

    animateCount('statFiles',    rows.length);
    animateCount('statModules',  modules.size);
    animateCount('statFilieres', filieres.size);
    animateCount('statSems',     sems.size);

    // --- Populate filiere tags ---
    const grid = document.getElementById('filiereGrid');
    if (grid) {
      grid.innerHTML = '';
      [...filieres].sort().forEach(fil => {
        const tag = document.createElement('span');
        tag.className = 'filiere-tag';
        tag.textContent = fil;
        grid.appendChild(tag);
      });
    }
  });
};
