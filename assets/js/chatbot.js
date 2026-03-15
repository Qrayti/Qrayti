/* =====================================================================
 * QRAYTI.MA - AI CHATBOT LOGIC
 * Powered by DeepSeek API & Local Document Metadata
 * ===================================================================== */

let chatHistory = [];
const DEEPSEEK_API_KEY = "TO_BE_FILLED_BY_USER"; // Placeholder for user request

/**
 * Toggle the Chatbot UI
 */
window.toggleChatbot = function() {
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
  msgDiv.textContent = text;
  container.appendChild(msgDiv);

  if (suggestions.length > 0) {
    suggestions.forEach(doc => {
      const sugDiv = document.createElement('div');
      sugDiv.className = 'msg-suggestion';
      sugDiv.onclick = () => openPdf(doc.id, doc.titre, !!doc.lienURL);
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
window.handleChatSend = async function() {
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
    const response = await askDeepSeek(userQuery);
    addBotMessage(response.answer, response.suggestions);
  } catch (err) {
    console.error("AI Error:", err);
    addBotMessage("Désolé, je rencontre une petite difficulté technique. Pouvez-vous reformuler ?");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '→';
  }
};

/**
 * DeepSeek API Integration
 */
async function askDeepSeek(query) {
  // 1. Prepare context from globalData (limited to relevant docs to save tokens)
  // We'll search titles and descriptions locally first to identify potential candidates
  const lowerQuery = query.toLowerCase();
  const candidates = (window.globalData || []).filter(d => {
    const text = `${d.titre} ${d.description || ''} ${d.module}`.toLowerCase();
    return lowerQuery.split(' ').some(word => word.length > 3 && text.includes(word));
  }).slice(0, 5);

  const contextStr = candidates.map((d, i) => 
    `ID_${i}: ${d.titre} (${detectItemType(d)}) - Desc: ${d.description || 'N/A'}`
  ).join('\n');

  const systemPrompt = `Tu es l'assistant de Qrayti.ma, une plateforme pour les étudiants de la FSDM (Faculté des Sciences Dhar El Mahraz). 
  Ta mission est de suggérer des fichiers aux étudiants.
  Voici les documents disponibles correspondant à la requête :\n${contextStr}\n
  Réponds gentiment en français. Si tu trouves des documents pertinents, cite-les. 
  À la fin de ta réponse, écris uniquement les indices des documents suggérés sous ce format: SUGGEST:[ID_0, ID_1]`;

  // IF NO API KEY, simulate for now
  if (DEEPSEEK_API_KEY === "TO_BE_FILLED_BY_USER") {
    return {
      answer: "Je suis prêt ! Pour activer mon intelligence DeepSeek, veuillez ajouter votre clé API dans le code. En attendant, voici ce que j'ai trouvé localement :",
      suggestions: candidates
    };
  }

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ]
    })
  });

  const data = await res.json();
  const aiText = data.choices[0].message.content;

  // Extract suggestions from AI text
  const match = aiText.match(/SUGGEST:\[(.*?)\]/);
  let finalSuggestions = [];
  if (match) {
    const indices = match[1].split(',').map(s => parseInt(s.trim().replace('ID_', '')));
    finalSuggestions = indices.map(idx => candidates[idx]).filter(Boolean);
  }

  return {
    answer: aiText.replace(/SUGGEST:\[.*?\]/, '').trim(),
    suggestions: finalSuggestions
  };
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
