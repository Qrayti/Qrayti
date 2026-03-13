/* =====================================================================
 * QRAYTI.MA - CONTACT PAGE LOGIC
 * Fetches contact.json locally and dynamically renders compact contact rows
 * ===================================================================== */

window.showPage = function() {
  const grid = document.getElementById('contactGrid');
  const errorBox = document.getElementById('contactError');
  const loader = document.getElementById('loadingContacts');

  fetch('contact.json?v=1')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
      return r.json();
    })
    .then(data => {
      if (loader) loader.style.display = 'none';
      renderContacts(data.contacts || data);
    })
    .catch(err => {
      if (loader) loader.style.display = 'none';
      if (errorBox) {
        errorBox.style.display = 'block';
        errorBox.innerHTML = `
          <div>⚠️ <span data-i18n="contact_error_title">Erreur de chargement</span></div>
          <p style="margin-top:8px; font-size:13px; color:var(--muted);">${err.message}</p>
        `;
        renderI18n();
      }
    });

  function renderContacts(items) {
    // Switch the container to a list (not a grid)
    grid.className = 'contact-list';
    grid.innerHTML = '';

    const iconMap = {
      'whatsapp': '💬',
      'email':    '📧',
      'instagram':'📷',
      'facebook': '👥',
      'default':  '🔗'
    };

    items.forEach(item => {
      const typeKey = (item.title || '').toLowerCase();
      const icon = iconMap[typeKey] || iconMap['default'];

      const row = document.createElement('a');
      row.href = item.link || '#';
      row.target = '_blank';
      row.rel = 'noopener noreferrer';
      row.className = 'contact-row';

      row.innerHTML = `
        <div class="contact-row-icon ${typeKey}">${icon}</div>
        <div class="contact-row-text">
          <div class="contact-row-label">${item.title.toUpperCase()}</div>
          <div class="contact-row-value">${item.value}</div>
        </div>
        <span class="contact-row-arrow">→</span>
      `;
      grid.appendChild(row);
    });

    renderI18n();
  }
};
