/* =====================================================================
 * QRAYTI.MA - AI CHATBOT LOGIC
 * Powered by GROQ  API & Local Document Metadata
 * ===================================================================== */

let chatHistory = [];
// GAS_PROXY_URL will be defined by user

/**
 * Toggle the Chatbot UI
 */
window.toggleChatbot = function () {
  const win = document.getElementById('chatbotWindow');
  const trigger = document.getElementById('chatbotTrigger');
  if (!win || !trigger) return;

  const isOpen = win.classList.toggle('open');
  trigger.classList.toggle('active', isOpen);

  if (isOpen && chatHistory.length === 0) {
    addBotMessage(t('ai_greeting') || "Bonjour ! Je suis l'assistant Qrayti. Comment puis-je vous aider aujourd'hui ?");
  }
};

/**
 * Add a message to the chat UI
 */
function addBotMessage(text, suggestions = []) {
  const container = document.getElementById('chatbotMessages');
  if (!container) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = 'msg msg-ai';
  msgDiv.innerHTML = text.replace(/\n/g, '<br>');
  container.appendChild(msgDiv);

  // Render KaTeX for Math
  if (window.renderMathInElement) {
    renderMathInElement(msgDiv, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true }
      ],
      throwOnError: false
    });
  }

  if (suggestions.length > 0) {
    suggestions.forEach(doc => {
      const sugDiv = document.createElement('div');
      sugDiv.className = 'msg-suggestion';
      sugDiv.onclick = () => {
        // Prepare navigation parameters using the new dynamic path
        const navParams = {
          level: 'files',
          path: doc.path || []
        };

        const isUrl = String(doc.id).startsWith('http');

        // If on browse.html, navigate instantly. If on index, go to browse.html with params.
        if (window.location.pathname.includes('browse.html')) {
          if (typeof window.navigateLevel === 'function') {
            window.navigateLevel(navParams);
            setTimeout(() => openPdf(doc.id, doc.titre, isUrl), 300);
          }
        } else {
          // Store state for browse page to pick up
          sessionStorage.setItem('pending_nav', JSON.stringify(navParams));
          sessionStorage.setItem('pending_pdf', JSON.stringify({ id: doc.id, titre: doc.titre, isUrl: isUrl }));
          window.location.href = 'browse.html';
        }
      };
      sugDiv.innerHTML = `
        <div class="msg-suggestion-icon">${typeIcon(detectItemType(doc))}</div>
        <div class="msg-suggestion-title">${doc.titre}</div>
      `;
      container.appendChild(sugDiv);
    });
  }

  container.scrollTop = container.scrollHeight;
  chatHistory.push({ role: 'assistant', content: text });
}

function addUserMessage(text) {
  const container = document.getElementById('chatbotMessages');
  if (!container) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = 'msg msg-user';
  msgDiv.textContent = text;
  container.appendChild(msgDiv);

  container.scrollTop = container.scrollHeight;
  chatHistory.push({ role: 'user', content: text });
}

/**
 * Handle Send Action
 */
window.handleChatSend = async function () {
  const input = document.getElementById('chatbotInput');
  const btn = document.getElementById('chatbotSendBtn');
  if (!input || !input.value.trim()) return;

  const userQuery = input.value.trim();
  addUserMessage(userQuery);
  input.value = '';

  // Start loading state
  btn.disabled = true;
  btn.innerHTML = '...';

  try {
    showTypingIndicator();
    const res = await askAI(userQuery);
    hideTypingIndicator();
    addBotMessage(res.answer, res.suggestions);
  } catch (err) {
    hideTypingIndicator();
    console.error("CHAT_HANDLE_ERROR:", err);
    addBotMessage(`⚠️ Erreur : ${err.message}. Vérifiez la console (F12) pour plus de détails.`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '→';
  }
};

function showTypingIndicator() {
  hideTypingIndicator(); // Ensure no duplicates
  const container = document.getElementById('chatbotMessages');
  if (!container) return;
  const div = document.createElement('div');
  div.id = 'typingIndicator';
  div.className = 'msg msg-ai typing';
  div.innerHTML = '<span>.</span><span>.</span><span>.</span>';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function hideTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

const GAS_PROXY_URL = "https://script.google.com/macros/s/AKfycbxZekg2a1gyTfyFVMuPGpeJVnF0OQHXmy-V_GKioIC6qw8QXtcmEwkBpZl2elCtCreZdw/exec"; // The URL from your deployed Apps Script Web App

// ...

async function askAI(query) {
  const activeFileId = window.QRAYTI ? window.QRAYTI.activeFileId : null;
  const currentLang = localStorage.getItem('lang') || 'fr';

  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(/\s+/).filter(w => w.length > 2);

  const candidates = (window.globalData || []).filter(d => {
    const text = `${d.titre} ${d.description || ''} ${d.module}`.toLowerCase();
    return words.some(word => text.includes(word));
  }).filter(d => d.id).slice(0, 15);

  const contextStr = candidates.map((d, i) =>
    `[DOC_${i}] ${d.titre} | Type: ${d.type} | Module: ${d.module} | Desc: ${d.description || 'N/A'}`
  ).join('\n');

  if (GAS_PROXY_URL === "TO_BE_FILLED_BY_USER") {
    return {
      answer: "Je suis presque prêt ! Veuillez configurer l'URL de votre Web App dans 'chatbot.js'.",
      suggestions: candidates.slice(0, 3)
    };
  }

  try {
    const response = await fetch(GAS_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        message: query,
        context: contextStr,
        fileId: activeFileId,
        lang: currentLang
      })
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("GAS_RESPONSE_NOT_JSON:", text);
      throw new Error(t('ai_error') || "Service indisponible.");
    }

    if (data.error) {
      console.error("AI_PROXY_ERROR:", data.error);
      if (data.error === "REPAIR_MODE") {
        throw new Error(t('ai_repair_mode') || "AI CHATBOT IS UNDER REPAIR, PLEASE TRY AGAIN LATER 🎓");
      }
      throw new Error(t('ai_error') || data.error);
    }

    const aiText = data.reply || "";

    const jsonMatch = aiText.match(/SUGGEST_JSON:(\[.*?\])/);
    let finalSuggestions = [];
    let cleanAnswer = aiText;

    if (jsonMatch) {
      try {
        const rawSuggestions = JSON.parse(jsonMatch[1]);
        cleanAnswer = aiText.replace(/SUGGEST_JSON:\[.*?\]/, '').trim();

        finalSuggestions = rawSuggestions.map(sug => {
          const fullDoc = (window.globalData || []).find(d => d.id === sug.id);
          return fullDoc || sug;
        });
      } catch (e) {
        console.error("Failed to parse AI suggestions JSON", e);
      }
    }

    return {
      answer: cleanAnswer,
      suggestions: finalSuggestions
    };

  } catch (err) {
    console.error("ASK_AI_ERROR:", err);
    throw new Error(t('ai_error') || "Service indisponible.");
  }
}

// Bind Enter key
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('chatbotInput');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleChatSend();
    });
  }
});
