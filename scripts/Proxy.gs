/**
 * QRAYTI SECURE PROXY
 * This script serves as a bridge between the website and the Gemini API.
 * It protects your API Key by keeping it server-side.
 */

const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
const PRIMARY_MODEL = "models/gemini-2.0-flash-lite"; 
const SECONDARY_MODEL = "models/gemini-flash-lite-latest"; 

/**
 * Handle POST requests from the website
 */
function doPost(e) {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error("API Key manquante dans Script Properties (GEMINI_API_KEY)");
    }

    const data = JSON.parse(e.postData.contents);
    const userQuery = data.query;
    const context = data.context || "";
    const activeFileId = data.fileId || null;

    if (!userQuery) throw new Error("No query provided");

    // Try Primary Model
    let response;
    try {
      console.log("Attempting Primary Model: " + PRIMARY_MODEL);
      response = callGemini(userQuery, context, activeFileId, PRIMARY_MODEL);
    } catch (primaryErr) {
      console.warn("Primary Model Failed: " + primaryErr.message);
      console.log("Attempting Failover: " + SECONDARY_MODEL);
      // Failover to Secondary Model
      response = callGemini(userQuery, context, activeFileId, SECONDARY_MODEL);
    }
    
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    console.error("PROXY_CRITICAL_ERROR: " + err.message);
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Call Gemini API with strict study-only guardrails
 */
function callGemini(query, context, fileId, modelName) {
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

  const systemInstructions = `Tu es l'assistant académique de Qrayti.ma (FSDM). 
  
  DIRECTIVES CRITIQUES :
  1. PERIMETRE : Aide UNIQUEMENT pour les études universitaires, le cursus FSDM ou les fichiers fournis. 
  2. REFUS : Toute demande hors sujet (recettes, divertissement, programmation de jeux, bavardage) doit être refusée avec : "Je suis l'assistant académique de Qrayti. Je ne peux vous assister que dans vos études universitaires."
  3. STYLE : Pas de bavardage ("Small Talk"). Réponds directement et immédiatement.
  4. LOGIQUE "ANSWER-THEN-SUGGEST" : Réponds à la question, puis suggère des ressources pertinentes parmi la liste fournie.
  5. FORMATAGE DES CARTES : Si tu suggères des fichiers de la liste, ajoute à la fin de ta réponse un bloc JSON pur sous le format suivant : SUGGEST_JSON:[{"id":"...", "titre":"..."}]
  
  CONTEXTE DISPONIBLE :
  - Fichiers pertinents trouvés :\n${context}\n
  - Fichier actuellement ouvert : ${fileId ? fileId : "Aucun"}`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: query }]
      }
    ],
    system_instruction: {
      parts: [{ text: systemInstructions }]
    },
    generationConfig: {
      temperature: 0.2, // Lower temperature for more factual academic responses
      maxOutputTokens: 1000
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const result = JSON.parse(response.getContentText());

  if (responseCode !== 200) {
    throw new Error(`Gemini API Error (${responseCode}): ${result.error ? result.error.message : "Inconnue"}`);
  }

  if (!result.candidates || !result.candidates[0].content) {
    throw new Error("Désolé, l'IA n'a pas pu générer de réponse.");
  }

  return {
    answer: result.candidates[0].content.parts[0].text
  };
}

