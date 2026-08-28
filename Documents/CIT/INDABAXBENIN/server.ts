import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import {
  buildCsvUrl,
  extractGid,
  extractSpreadsheetId,
  isAllowedGoogleUrl,
  mapUserAccounts,
  normalizeEmail,
  parseCsv,
  toTable,
} from "./src/lib/sheets";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "20mb" }));

// Lazy initialize Gemini client
function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  return new GoogleGenAI({ apiKey });
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString(), event: "IndabaX Bénin 2026" });
});

/* ================================================================== *
 *  BASE DE DONNÉES GOOGLE SHEET (AppSheet)
 *
 *  L'application ne dépend d'aucun projet Google Cloud ni de Firebase.
 *  Le classeur Google Sheet qui sert de base à l'app AppSheet est lu
 *  ici côté serveur, via son simple lien de partage. Le serveur agit
 *  comme relais afin d'éviter les blocages CORS du navigateur.
 * ================================================================== */

const FETCH_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

/** Lit un onglet du classeur et renvoie ses lignes sous forme d'objets. */
async function readSheetTab(sheetUrl: string, tab?: string) {
  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  if (!spreadsheetId) {
    throw Object.assign(new Error("Lien Google Sheets invalide ou identifiant introuvable."), { status: 400 });
  }

  // Si le lien pointe déjà vers un onglet précis (#gid=...), on le respecte
  // sauf si un nom d'onglet explicite est demandé.
  const gid = tab ? null : extractGid(sheetUrl);
  const csvUrl = buildCsvUrl(spreadsheetId, { tab, gid });

  if (!isAllowedGoogleUrl(csvUrl)) {
    throw Object.assign(new Error("URL sortante non autorisée."), { status: 400 });
  }

  const response = await fetchWithTimeout(csvUrl);

  if (!response.ok) {
    throw Object.assign(
      new Error(
        response.status === 404
          ? `Onglet "${tab || "par défaut"}" introuvable dans le classeur.`
          : `Le classeur n'est pas accessible (HTTP ${response.status}). Vérifiez qu'il est partagé en lecture avec "Tous les utilisateurs disposant du lien".`,
      ),
      { status: 502 },
    );
  }

  const body = await response.text();

  // Une page HTML au lieu d'un CSV signifie que le partage n'est pas ouvert.
  if (body.trimStart().toLowerCase().startsWith("<!doctype html") || body.trimStart().startsWith("<HTML")) {
    throw Object.assign(
      new Error(
        "Le classeur a répondu une page de connexion : partagez-le en lecture avec \"Tous les utilisateurs disposant du lien\".",
      ),
      { status: 502 },
    );
  }

  return toTable(parseCsv(body));
}

// LECTURE d'un onglet du classeur
app.post("/api/sheets/read", async (req, res) => {
  try {
    const { sheetUrl, tab } = req.body ?? {};

    if (typeof sheetUrl !== "string" || !sheetUrl.trim()) {
      return res.status(400).json({ error: "Le lien du classeur Google Sheet est requis." });
    }

    const table = await readSheetTab(sheetUrl, typeof tab === "string" && tab.trim() ? tab.trim() : undefined);

    res.json({
      headers: table.headers,
      rows: table.rows,
      count: table.rows.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in /api/sheets/read:", error.message);
    res.status(error.status || 500).json({ error: error.message || "Lecture du classeur impossible." });
  }
});

// AUTHENTIFICATION : l'email est recherché dans l'onglet des comptes,
// le rôle appliqué est celui que l'administrateur y a inscrit.
app.post("/api/auth/login", async (req, res) => {
  try {
    const { sheetUrl, usersTab, email, code } = req.body ?? {};

    const cleanEmail = normalizeEmail(typeof email === "string" ? email : "");
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return res.status(400).json({ error: "Adresse email invalide." });
    }

    if (typeof sheetUrl !== "string" || !sheetUrl.trim()) {
      return res.status(400).json({ error: "Aucune base de données liée : renseignez le lien du classeur." });
    }

    const table = await readSheetTab(sheetUrl, typeof usersTab === "string" && usersTab.trim() ? usersTab.trim() : undefined);
    const accounts = mapUserAccounts(table);
    const account = accounts.find(candidate => candidate.email === cleanEmail);

    if (!account) {
      return res.status(404).json({
        error: "Cet email ne figure pas dans la base des comptes. Contactez un organisateur pour être ajouté.",
        reason: "not_found",
      });
    }

    if (account.status === "suspended") {
      return res.status(403).json({ error: "Ce compte a été suspendu par l'administrateur.", reason: "suspended" });
    }

    // Le code d'accès n'est exigé que si la colonne est remplie pour ce compte.
    if (account.accessCode) {
      const providedCode = typeof code === "string" ? code.trim() : "";
      if (!providedCode) {
        return res.status(401).json({ error: "Un code d'accès est requis pour ce compte.", reason: "code_required" });
      }
      if (providedCode.toLowerCase() !== account.accessCode.trim().toLowerCase()) {
        return res.status(401).json({ error: "Code d'accès incorrect.", reason: "bad_code" });
      }
    }

    // Le code d'accès ne quitte jamais le serveur.
    const { accessCode, ...safeAccount } = account;

    res.json({
      user: safeAccount,
      requiresCode: Boolean(accessCode),
      totalAccounts: accounts.length,
    });
  } catch (error: any) {
    console.error("Error in /api/auth/login:", error.message);
    res.status(error.status || 500).json({ error: error.message || "Authentification impossible." });
  }
});

// ÉCRITURE (optionnelle) : relais vers un Apps Script Web App ou l'API AppSheet.
app.post("/api/sheets/write", async (req, res) => {
  try {
    const { webhookUrl, appSheet, table, rows } = req.body ?? {};

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "Aucune ligne à écrire." });
    }

    // Voie 1 : Apps Script Web App (doPost) déployé sur le classeur.
    if (typeof webhookUrl === "string" && webhookUrl.trim()) {
      if (!isAllowedGoogleUrl(webhookUrl)) {
        return res.status(400).json({ error: "L'URL du Apps Script doit être un lien script.google.com en HTTPS." });
      }

      const response = await fetchWithTimeout(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, rows }),
      });

      const text = await response.text();
      if (!response.ok) {
        return res.status(502).json({ error: `Le Apps Script a répondu HTTP ${response.status}.`, details: text.slice(0, 500) });
      }

      return res.json({ ok: true, via: "apps-script", written: rows.length, response: text.slice(0, 500) });
    }

    // Voie 2 : API AppSheet (App ID + Access Key).
    if (appSheet?.appId && appSheet?.accessKey && table) {
      const appSheetUrl = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(appSheet.appId)}/tables/${encodeURIComponent(table)}/Action`;

      const response = await fetchWithTimeout(appSheetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ApplicationAccessKey: appSheet.accessKey,
        },
        body: JSON.stringify({ Action: "Add", Properties: { Locale: "fr-FR" }, Rows: rows }),
      });

      const text = await response.text();
      if (!response.ok) {
        return res.status(502).json({ error: `AppSheet a répondu HTTP ${response.status}.`, details: text.slice(0, 500) });
      }

      return res.json({ ok: true, via: "appsheet", written: rows.length });
    }

    res.status(400).json({
      error:
        "Aucune voie d'écriture configurée. Renseignez soit l'URL d'un Apps Script Web App, soit l'App ID et la clé d'accès AppSheet.",
      reason: "no_write_target",
    });
  } catch (error: any) {
    console.error("Error in /api/sheets/write:", error.message);
    res.status(500).json({ error: error.message || "Écriture impossible." });
  }
});

/* ================================================================== *
 *  ASSISTANT IA (Gemini)
 * ================================================================== */

// AI Concierge: Ask questions about IndabaX Bénin
app.post("/api/ai/ask", async (req, res) => {
  try {
    const { prompt, context, chatHistory } = req.body;
    const ai = getAI();

    const systemInstruction = `Tu es l'assistant officiel de l'événement IndabaX Bénin 2026 (inspiré de la plateforme Baobab du Deep Learning Indaba).
Ton rôle est de guider chaleureusement les participants, chercheurs, conférenciers et organisateurs à Cotonou / Bénin.
Tu fournis des informations précises sur le programme, les sessions de Deep Learning, NLP (notamment sur les langues locales comme le Fongbe, Yoruba), Vision par ordinateur, IA pour la santé et l'agriculture, les ateliers pratiques, les salles (Amphithéâtre Houdégbé, Sèmè One, Lab IA), le networking, et les opportunités de recherche en Afrique.
Réponds en français fluide, concis, bien structuré et enthousiaste.`;

    const contents = [
      {
        role: "user",
        parts: [
          {
            text: `Contexte actuel de l'événement:\n${JSON.stringify(context || {})}\n\nQuestion de l'utilisateur: ${prompt}`
          }
        ]
      }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    res.json({ text: response.text || "Désolé, je n'ai pas pu générer de réponse pour le moment." });
  } catch (error: any) {
    console.error("Error in /api/ai/ask:", error);
    res.status(500).json({
      error: "Erreur lors du traitement de votre demande IA",
      details: error.message
    });
  }
});

// AI Matchmaker: Suggest networking connections between attendees
app.post("/api/ai/matchmake", async (req, res) => {
  try {
    const { userProfile, attendees } = req.body;
    const ai = getAI();

    const prompt = `Voici le profil d'un participant à IndabaX Bénin:
${JSON.stringify(userProfile)}

Voici la liste des autres participants inscrits:
${JSON.stringify(attendees)}

Analyse les centres d'intérêt, les compétences en IA, les projets de recherche et les objectifs pour recommander les 3 à 4 personnes les plus pertinentes avec qui réseauter.
Pour chaque personne, donne:
1. Le nom
2. Pourquoi ils devraient échanger (points communs et synergies de recherche/projets)
3. Une phrase d'amorce de conversation (icebreaker) personnalisée.

Formatte ta réponse en JSON avec la structure:
{
  "recommendations": [
    {
      "attendeeId": "id",
      "name": "Nom",
      "reason": "Raison de la recommandation",
      "icebreaker": "Question ou phrase suggérée"
    }
  ],
  "summaryTip": "Conseil général pour maximiser son networking à IndabaX Bénin"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
      }
    });

    const jsonText = response.text || "{}";
    const data = JSON.parse(jsonText);
    res.json(data);
  } catch (error: any) {
    console.error("Error in /api/ai/matchmake:", error);
    res.status(500).json({
      error: "Erreur lors du matchmaking IA",
      details: error.message
    });
  }
});

// AI Image Understanding: Analyze posters, event photos, badges
app.post("/api/ai/analyze-image", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", prompt = "Analyse ce poster de recherche ou cette photo de l'événement IndabaX Bénin et résume les points clés." } = req.body;
    const ai = getAI();

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
    });

    res.json({ text: response.text || "Analyse terminée sans texte généré." });
  } catch (error: any) {
    console.error("Error in /api/ai/analyze-image:", error);
    res.status(500).json({
      error: "Erreur lors de l'analyse d'image",
      details: error.message
    });
  }
});

// AI Feedback Digest: Summarize session feedbacks for organizers
app.post("/api/ai/feedback-summary", async (req, res) => {
  try {
    const { sessionTitle, feedbacks } = req.body;
    const ai = getAI();

    const prompt = `Voici les retours reçus pour la session "${sessionTitle}" à IndabaX Bénin:
${JSON.stringify(feedbacks)}

Fournis une synthèse exécutive pour les organisateurs et le conférencier :
1. Note moyenne et sentiment général.
2. Points forts les plus appréciés.
3. Axes d'amélioration ou questions restées en suspens.
4. Recommandation pour les futures éditions.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    res.json({ summary: response.text || "Aucun résumé disponible." });
  } catch (error: any) {
    console.error("Error in /api/ai/feedback-summary:", error);
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`IndabaX Bénin Event App running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
