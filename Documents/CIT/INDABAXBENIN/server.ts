import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { authRouter } from "./server/routes/auth";
import { sheetsRouter } from "./server/routes/sheets";
import { aiRouter } from "./server/routes/ai";
import { getBootstrapAdminEmails, initStore } from "./server/store";
import { sessionCount, startSessionSweeper } from "./server/sessions";

dotenv.config();

const app = express();
const PORT = 3000;

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
  initStore();
  startSessionSweeper();

  const admins = getBootstrapAdminEmails();
  if (admins.length === 0) {
    console.warn(
      "ADMIN_EMAILS n'est pas renseigné : si aucun compte n'existe encore, personne ne pourra " +
        "ouvrir l'espace Super-Admin. Ajoutez ADMIN_EMAILS=\"vous@exemple.bj\" dans le fichier .env.",
    );
  } else {
    console.log(`Emails administrateurs d'amorçage : ${admins.join(", ")}`);
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
    console.log(`IndabaX Bénin Event App running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
