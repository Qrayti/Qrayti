/**
 * QRAYTI-BOT PROXY V4.3 (FINAL FIX)
 * - Bound script (uses getActiveSpreadsheet)
 * - REPAIR_MODE vs TECHNICAL_ISSUE distinction
 * - Robust body parsing
 * - doGet for debugging
 */

const GROQ_KEYS_RAW = PropertiesService.getScriptProperties().getProperty('GROQ_KEYS') || "";
const GROQ_KEYS = GROQ_KEYS_RAW.split(',').map(k => k.trim()).filter(k => k.length > 0);
const MODEL_NAME = "llama-3.3-70b-versatile";
const SYSTEM_PROMPT = 'Tu es Qrayti-Bot, l\'assistant académique de la FSDM. Aide les étudiants. Maths: LaTeX ($...$). Format: SUGGEST_JSON:[{"id":"...", "titre":"..."}]';

let _ssCache = null;
let _isMaintActive = null;

function getSS() {
  if (_ssCache) return _ssCache;
  try {
    _ssCache = SpreadsheetApp.getActiveSpreadsheet();
    return _ssCache;
  } catch (e) { return null; }
}

function isMaintenanceMode() {
  if (_isMaintActive !== null) return _isMaintActive;
  const ss = getSS();
  if (!ss) return (_isMaintActive = false);
  try {
    const sheet = ss.getSheetByName("SETTINGS");
    if (sheet) {
      const val = sheet.getRange("A2").getValue();
      _isMaintActive = (val && val.toString().trim().toLowerCase() === "on");
    } else {
      _isMaintActive = false;
    }
  } catch (e) {
    _isMaintActive = false;
  }
  return _isMaintActive;
}

/**
 * Called by the website (POST request)
 */
function doPost(e) {
  try {
    // 1. REPAIR MODE CHECK
    if (isMaintenanceMode()) {
      return buildResponse({ "error": "REPAIR_MODE" });
    }

    // 2. PARSE BODY - handle both postData types
    let data = {};
    try {
      const body = e.postData ? e.postData.contents : "{}";
      data = JSON.parse(body);
    } catch (parseErr) {
      logErrorToSheet("PARSE_ERROR", parseErr.toString(), "N/A");
      return buildResponse({ "error": "TECHNICAL_ISSUE" });
    }

    // 3. EXTRACT AND GUARD values
    const query = String(data.message || data.query || "").trim();
    const context = String(data.context || "Pas de contexte.").trim();

    // If somehow the query is truly empty, return a helpful default
    if (!query) {
      return buildResponse({ "reply": "Bonjour ! Comment puis-je vous aider ?" });
    }

    if (GROQ_KEYS.length === 0) {
      logErrorToSheet("CONFIG_ERROR", "GROQ_KEYS property is empty!", "N/A");
      return buildResponse({ "error": "TECHNICAL_ISSUE" });
    }

    const finalPrompt = "CONTEXTE :\n" + context + "\n\nQUESTION :\n" + query;
    const reply = callGroq(finalPrompt);

    return buildResponse({ "reply": reply });

  } catch (err) {
    const isMaint = isMaintenanceMode();
    if (!isMaint) {
      logErrorToSheet("CRITICAL", err.toString(), "N/A");
    }
    return buildResponse({ "error": isMaint ? "REPAIR_MODE" : "TECHNICAL_ISSUE" });
  }
}

/**
 * Called when something accesses the URL via GET (browser, ping, etc.)
 * Returns a health check - useful for debugging
 */
function doGet(e) {
  const maintenanceStatus = isMaintenanceMode() ? "ON" : "OFF";
  const keysStatus = GROQ_KEYS.length > 0 ? GROQ_KEYS.length + " key(s) loaded" : "NO KEYS FOUND";
  const info = "Qrayti-Bot Proxy V4.3 | Status: OK | Maintenance: " + maintenanceStatus + " | Keys: " + keysStatus;
  return ContentService.createTextOutput(info).setMimeType(ContentService.MimeType.TEXT);
}

function callGroq(promptText) {
  const randomKey = GROQ_KEYS[Math.floor(Math.random() * GROQ_KEYS.length)];
  const url = "https://api.groq.com/openai/v1/chat/completions";

  const payload = {
    "model": MODEL_NAME,
    "messages": [
      { "role": "system", "content": SYSTEM_PROMPT },
      { "role": "user",   "content": String(promptText) }
    ],
    "temperature": 0.3
  };

  const options = {
    "method": "post",
    "headers": {
      "Authorization": "Bearer " + randomKey,
      "Content-Type": "application/json"
    },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());

  if (json.choices && json.choices.length > 0) {
    return json.choices[0].message.content;
  }

  const errMsg = json.error ? json.error.message : "Empty response from Groq";
  logErrorToSheet("API_ERROR", errMsg, randomKey.substring(0, 10));
  throw new Error("GROQ_FAILURE: " + errMsg);
}

function logErrorToSheet(type, message, keyHint) {
  if (isMaintenanceMode()) return;
  const ss = getSS();
  if (!ss) return;
  try {
    const sheet = ss.getSheetByName("ERROR LOGS");
    if (sheet) sheet.appendRow([new Date(), type, message, keyHint || ""]);
  } catch (e) {}
}

function buildResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
