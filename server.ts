import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { authRouter } from "./server/routes/auth";
import { sheetsRouter } from "./server/routes/sheets";
import { aiRouter } from "./server/routes/ai";
import { socialRouter } from "./server/routes/social";
import { eventRouter } from "./server/routes/event";
import { reloadEventConfig } from "./server/eventConfig";
import { warmSocialCache } from "./server/social";
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
import { startTokenSweeper } from "./server/resetTokens";

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
app.use("/api/social", socialRouter);
app.use("/api/event", eventRouter);

async function startServer() {
  await initStore();
  startSessionSweeper();
  startTokenSweeper();

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
        await readTab(getSheetsConfig().profilesTab, undefined, expectedHeadersFor("profiles")),
      ),
    );

    console.log(
      result.linked
        ? `Classeur Google Sheet lié : ${result.accounts} compte(s) chargé(s) depuis l'onglet « ${sheets.profilesTab} ».`
        : `Classeur configuré mais illisible : ${result.error}`,
    );
  } else {
    console.log(
      sheets.isLinked
        ? `Classeur Google Sheet lié, onglet des comptes « ${sheets.profilesTab} ».`
        : "Aucun classeur lié : connectez-vous puis renseignez le lien dans l'espace Super-Admin.",
    );
  }

  // La configuration de l'événement est lue avant d'ouvrir le service : le
  // tout premier visiteur doit voir le bon nom d'événement et les bons rôles,
  // et c'est cette table de rôles qui autorisera ensuite chaque requête.
  try {
    const { config, avertissements } = await reloadEventConfig();

    console.log(
      config.fromSheet
        ? `Événement « ${config.identity.eventName} ${config.identity.edition} » : ` +
            `${config.roles.length} rôle(s) lus dans le classeur.`
        : `Aucun onglet « Configuration » ni « Rôles » dans le classeur : ` +
            `les six rôles livrés s'appliquent.`,
    );

    for (const avertissement of avertissements) console.warn(`  ${avertissement}`);
  } catch (error) {
    // Une configuration illisible ne doit pas empêcher le service de démarrer :
    // les valeurs livrées suffisent à se connecter et à la corriger.
    console.warn(
      `Configuration de l'événement illisible, valeurs livrées appliquées : ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Les annonces et les messages sont relus une première fois maintenant : le
  // premier visiteur n'attend donc pas la lecture du classeur.
  await warmSocialCache();

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
