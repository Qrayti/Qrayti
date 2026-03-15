/**
 * QRAYTI.MA - THE LIBRARIAN 📚
 * ---------------------------------------------------------------------
 * Description: Uses Gemini 3 Flash to extract metadata from Google Sheet
 * files and populate descriptions, professors, and types.
 * ---------------------------------------------------------------------
 * LIMITS: 
 * - Rate: 15 Requests Per Minute (RPM)
 * - Duration: 6 Minutes per execution
 */

const GEMINI_API_KEY = "PASTE_YOUR_KEY_HERE";
// const MAIN_SHEET_NAME = "MAIN"; // Already declared in your Scraper script

function runLibrarian() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetMain = ss.getSheetByName(MAIN_SHEET_NAME);
  const sheetRename = ss.getSheetByName("Renaming");
  const sheetReType = ss.getSheetByName("ReType");
  const sheetFolderMap = ss.getSheetByName("Folder Map");

  const data = sheetMain.getDataRange().getValues();
  
  // Mapping based on your screenshot
  const col = {
    dept: 0,     // A
    filiere: 1,  // B
    semester: 2, // C
    module: 3,   // D
    prof: 4,     // E
    type: 5,     // F
    title: 6,    // G
    id: 7,       // H
    desc: 8,     // I
    progress: 9  // J
  };

  const startTime = new Date().getTime();
  const MAX_TIME = 300000; // 5 minutes

  for (let i = 1; i < data.length; i++) {
    if (new Date().getTime() - startTime > MAX_TIME) break;

    const row = data[i];
    if (row[col.progress] === "DONE") continue;

    const currentTitle = row[col.title];
    const currentId = row[col.id];
    const currentPath = `/${row[col.dept]}/${row[col.filiere]}/${row[col.semester]}/${row[col.module]}`;

    try {
      const ai = getGeminiMetadata(currentTitle, currentPath);
      if (!ai) continue;

      // 1. Update MAIN sheet
      sheetMain.getRange(i + 1, col.prof + 1).setValue(ai.professor);
      sheetMain.getRange(i + 1, col.type + 1).setValue(ai.type);
      sheetMain.getRange(i + 1, col.desc + 1).setValue(ai.description);
      sheetMain.getRange(i + 1, col.progress + 1).setValue("DONE");

      // 2. Populate Renaming Sheet (Col A: Current, B: Suggested, C: ID, D: Status)
      sheetRename.appendRow([currentTitle, ai.suggested_filename, currentId, "PENDING"]);

      // 3. Populate ReType Sheet (A: Name, B: Sug Name, C: Cur Type, D: Sug Type, E: ID, F: Status)
      sheetReType.appendRow([currentTitle, ai.suggested_filename, row[col.type], ai.type, currentId, "PENDING"]);

      // 4. Populate Folder Map (A: Name, B: Sug Name, C: Cur Type, D: Sug Type, E: Cur Path, F: Sug Path, G: ID, H: Status)
      const suggestedPath = `/FSDM/${ai.suggested_semester}/${ai.suggested_filiere}/${ai.suggested_module}/${ai.type}`;
      sheetFolderMap.appendRow([
        currentTitle, 
        ai.suggested_filename, 
        row[col.type], 
        ai.type, 
        currentPath, 
        suggestedPath, 
        currentId, 
        "PENDING"
      ]);

      Utilities.sleep(4000); // 15 RPM limit

    } catch (e) {
      Logger.log("Error row " + (i+1) + ": " + e.message);
      sheetMain.getRange(i + 1, col.progress + 1).setValue("ERROR");
    }
  }
}

function getGeminiMetadata(title, path) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const prompt = `Tu es un expert FSDM. Analyse ce fichier: "${title}" situé dans "${path}".
  Génère des suggestions pour mieux organiser la bibliothèque.
  
  Format de réponse JSON uniquement:
  {
    "professor": "Nom",
    "type": "COURS|TD|TP|EXAM",
    "description": "Phrase courte",
    "suggested_filename": "Nom_Fichier_Propre.pdf",
    "suggested_filiere": "Code Filière court",
    "suggested_semester": "S1..S6",
    "suggested_module": "Nom Module court"
  }`;

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: "application/json" }
    })
  };

  const res = UrlFetchApp.fetch(url, options);
  return JSON.parse(JSON.parse(res.getContentText()).candidates[0].content.parts[0].text);
}
