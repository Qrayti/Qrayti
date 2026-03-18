/**
 * QRAYTI-BOT PROXY V4.1 (REPAIR MODE VS TECHNICAL ERROR)
 * Final version for bound scripts.
 */

const GROQ_KEYS_RAW = PropertiesService.getScriptProperties().getProperty('GROQ_KEYS') || "";
const GROQ_KEYS = GROQ_KEYS_RAW.split(',').map(k => k.trim()).filter(k => k.length > 0);

const MODEL_NAME = "llama-3.3-70b-versatile";
const SYSTEM_INSTRUCTION = `Tu es Qrayti-Bot, l'assistant académique de la FSDM. Aide les étudiants à trouver des ressources. MATHS: LaTeX ($...$). FORMAT: SUGGEST_JSON:[{"id":"...", "titre":"..."}].`;

let _ssCache = null;

function getSS() {
  if (_ssCache) return _ssCache;
  try {
    _ssCache = SpreadsheetApp.getActiveSpreadsheet();
    return _ssCache;
  } catch (e) { return null; }
}

function isMaintenanceMode() {
  const ss = getSS();
  if (!ss) return false;
  try {
    const sheet = ss.getSheetByName("SETTINGS");
    if (sheet) {
      const val = sheet.getRange("A2").getValue();
      if (val && val.toString().trim().toLowerCase() === "on") return true;
    }
    return false;
  } catch (e) { return false; }
}

function doPost(e) {
  try {
    // 1. REPAIR MODE CHECK
    if (isMaintenanceMode()) {
       return ContentService.createTextOutput(JSON.stringify({ "error": "REPAIR_MODE" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const data = JSON.parse(e.postData.contents);
    const query = data.message || data.query;
    const context = data.context || "";

    if (GROQ_KEYS.length === 0) throw new Error("API_KEYS_MISSING");

    const response = callGroqWithRotation("FICHIERS :\n" + context + "\n\nQUESTION : " + query);
    
    return ContentService.createTextOutput(JSON.stringify({ "reply": response }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    const isMaint = isMaintenanceMode();
    // Only log if it's a real technical failure
    if (!isMaint) {
      logErrorToSheet("CRITICAL", err.toString(), "N/A");
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      "error": isMaint ? "REPAIR_MODE" : "TECHNICAL_ISSUE" 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function callGroqWithRotation(prompt) {
  const randomKey = GROQ_KEYS[Math.floor(Math.random() * GROQ_KEYS.length)];
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const options = {
    "method": "post",
    "headers": { "Authorization": "Bearer " + randomKey, "Content-Type": "application/json" },
    "payload": JSON.stringify({ 
      "model": MODEL_NAME, 
      "messages": [{ "role": "system", "content": SYSTEM_INSTRUCTION }, { "role": "user", "content": prompt }], 
      "temperature": 0.3 
    }),
    "muteHttpExceptions": true
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());
  if (json.choices && json.choices.length > 0) return json.choices[0].message.content;
  
  logErrorToSheet("API_ERROR", json.error ? json.error.message : "Error", randomKey.substring(0, 10));
  throw new Error("API_FAIL");
}

function logErrorToSheet(type, message, keyHint) {
  const ss = getSS();
  if (!ss) return;
  try {
    const sheet = ss.getSheetByName("ERROR LOGS");
    // Only append if it's the official log sheet
    if (sheet) sheet.appendRow([new Date(), type, message, keyHint]);
  } catch (e) {}
}

function doOptions(e) {
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
}
