import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { authRouter } from "./server/routes/auth";
import { sheetsRouter } from "./server/routes/sheets";
import { aiRouter } from "./server/routes/ai";
import {
  ensureSuperAdmin,
  getBootstrapAdminEmails,
  getSheetsConfig,
  initStore,
  verifyConfiguredSheet,
} from "./server/store";
import { mapUserAccounts } from "./src/lib/sheets";
import { expectedHeadersFor, readTab } from "./server/sheetsGateway";
import { isCookieSecure, sessionCount, startSessionSweeper } from "./server/sessions";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

/** Normalisation minimale pour les messages de démarrage. */
const normalize = (value?: string) => (value || "").trim().toLowerCase();

// L'application et son API partagent la meme origine : les cookies de session
// suffisent, aucun en-tete CORS n'est ouvert.
app.set("trust proxy", 1);
app.use(express.json({ limit: "20mb" }));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    event: "IndabaX Bénin 2026",
    openSessions: sessionCount(),
  });
});

app.use("/api/auth", authRouter);
app.use("/api/sheets", sheetsRouter);
app.use("/api/ai", aiRouter);

async function startServer() {
  await initStore();
  startSessionSweeper();

  // Compte super-admin decrit dans l'environnement.
  const provisioned = await ensureSuperAdmin();
  const notConfigured = !provisioned.created && provisioned.reason === "not_configured";

  if (provisioned.created) {
    console.log(`Compte Super-Admin créé : ${provisioned.email}`);
  } else if (provisioned.reason === "already_exists") {
    console.log(`Compte Super-Admin déjà présent : ${normalize(process.env.SUPERADMIN_EMAIL)}`);
  }

  // Liste de secours, utilisable meme si la table des comptes est vide.
  const admins = getBootstrapAdminEmails();
  if (admins.length > 0 && !process.env.ADMIN_PASSWORD) {
    console.warn(
      `ADMIN_EMAILS est renseigné (${admins.join(", ")}) mais ADMIN_PASSWORD est vide : ` +
        "ces comptes de secours ne pourront pas se connecter.",
    );
  } else if (admins.length > 0) {
    console.log(`Emails administrateurs de secours : ${admins.join(", ")}`);
  }

  if (notConfigured && admins.length === 0) {
    console.warn(
      "Aucun compte Super-Admin configuré : renseignez SUPERADMIN_EMAIL et SUPERADMIN_PASSWORD " +
        "dans le fichier .env, sinon personne ne pourra lier le classeur.",
    );
  }

  // Le drapeau Secure du cookie est la cause la plus fréquente d'un « je me
  // connecte et rien ne se passe » : on l'affiche explicitement.
  if (process.env.NODE_ENV === "production" && !isCookieSecure()) {
    console.warn(
      "COOKIE_SECURE=false : le cookie de session circulera en clair. " +
        "À réserver à une mise en service provisoire en HTTP.",
    );
  } else if (process.env.NODE_ENV === "production") {
    console.log("Cookie de session : HttpOnly + Secure (HTTPS requis).");
  }

  // Un classeur configuré mais non encore vérifié est testé maintenant : après
  // un déploiement sur un hébergement sans disque persistant, l'application se
  // reconfigure ainsi d'elle-même, sans passage obligé par l'interface.
  const sheets = getSheetsConfig();

  if (sheets.masterSheetUrl.trim() && !sheets.isLinked) {
    const result = await verifyConfiguredSheet(async () =>
      mapUserAccounts(
        await readTab(getSheetsConfig().usersTab, undefined, expectedHeadersFor("users")),
      ),
    );

    console.log(
      result.linked
        ? `Classeur Google Sheet lié : ${result.accounts} compte(s) chargé(s) depuis l'onglet « ${sheets.usersTab} ».`
        : `Classeur configuré mais illisible : ${result.error}`,
    );
  } else {
    console.log(
      sheets.isLinked
        ? `Classeur Google Sheet lié, onglet des comptes « ${sheets.usersTab} ».`
        : "Aucun classeur lié : connectez-vous puis renseignez le lien dans l'espace Super-Admin.",
    );
  }

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
    console.log(`IndabaX Bénin Event App à l'écoute sur le port ${PORT}`);
  });
}

startServer();
