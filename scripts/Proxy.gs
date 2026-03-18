/**
 * QRAYTI-BOT PROXY V4.2 (BOUND SCRIPT - REPAIR_MODE vs TECHNICAL_ISSUE)
 */

const GROQ_KEYS_RAW = PropertiesService.getScriptProperties().getProperty('GROQ_KEYS') || "";
const GROQ_KEYS = GROQ_KEYS_RAW.split(',').map(k => k.trim()).filter(k => k.length > 0);
const MODEL_NAME = "llama-3.3-70b-versatile";
const SYSTEM_PROMPT = "Tu es Qrayti-Bot, l'assistant académique de la FSDM. Aide les étudiants. Maths: LaTeX ($...$). Format: SUGGEST_JSON:[{\"id\":\"...\", \"titre\":\"...\"}]";

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
  if (!ss) return false;
  try {
    const sheet = ss.getSheetByName("SETTINGS");
    if (sheet) {
      const val = sheet.getRange("A2").getValue();
      _isMaintActive = (val && val.toString().trim().toLowerCase() === "on");
      return _isMaintActive;
    }
    return false;
  } catch (e) { return false; }
}

function doPost(e) {
  try {
    // 1. REPAIR MODE CHECK (SETTINGS!A2)
    if (isMaintenanceMode()) {
      return ContentService.createTextOutput(JSON.stringify({ "error": "REPAIR_MODE" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const data = JSON.parse(e.postData.contents);
    const query = String(data.message || data.query || "Bonjour");
    const context = String(data.context || "Aucun contexte.");

    if (GROQ_KEYS.length === 0) throw new Error("API_KEYS_MISSING");

    const finalPrompt = "CONTEXTE :\n" + context + "\n\nQUESTION :\n" + query;
    const response = callGroqWithRotation(finalPrompt);

    return ContentService.createTextOutput(JSON.stringify({ "reply": response }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    const isMaint = isMaintenanceMode();
    // Only log real technical errors, not maintenance
    if (!isMaint) {
      logErrorToSheet("CRITICAL", err.toString(), "N/A");
    }
    return ContentService.createTextOutput(JSON.stringify({
      "error": isMaint ? "REPAIR_MODE" : "TECHNICAL_ISSUE"
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function callGroqWithRotation(promptText) {
  const randomKey = GROQ_KEYS[Math.floor(Math.random() * GROQ_KEYS.length)];
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const safePrompt = String(promptText || "Hello");

  const payload = {
    "model": MODEL_NAME,
    "messages": [
      { "role": "system", "content": SYSTEM_PROMPT },
      { "role": "user", "content": safePrompt }
    ],
    "temperature": 0.3
  };

  const options = {
    "method": "post",
    "headers": { "Authorization": "Bearer " + randomKey, "Content-Type": "application/json" },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());

  if (json.choices && json.choices.length > 0) {
    return json.choices[0].message.content;
  }

  const errorMsg = json.error ? json.error.message : "Response was empty";
  logErrorToSheet("API_ERROR", errorMsg, randomKey.substring(0, 10));
  throw new Error("GROQ_FAILURE: " + errorMsg);
}

function logErrorToSheet(type, message, keyHint) {
  // Never log when repair mode is ON
  if (isMaintenanceMode()) return;
  const ss = getSS();
  if (!ss) return;
  try {
    const sheet = ss.getSheetByName("ERROR LOGS");
    if (sheet) sheet.appendRow([new Date(), type, message, keyHint]);
  } catch (e) {}
}

function doOptions(e) {
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
}
