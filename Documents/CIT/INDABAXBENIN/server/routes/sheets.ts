import { Router } from 'express';
import { mapUserAccounts } from '../../src/lib/sheets';
import { extractSpreadsheetId } from '../../src/lib/sheets';
import {
  getPublicSheetsConfig,
  getSheetsConfig,
  hasWriteTarget,
  replaceAccounts,
  updateSheetsConfig,
} from '../store';
import { AuthedRequest, requireAuth, requireCapability, updateSessionsForEmail } from '../sessions';
import { readTab, SheetError, writeRows } from '../sheetsGateway';

export const sheetsRouter = Router();

/* ------------------------------------------------------------------ *
 * Configuration
 * ------------------------------------------------------------------ */

/**
 * Etat de la configuration, sans les secrets d'ecriture.
 * Accessible sans session : l'ecran de connexion doit pouvoir indiquer si un
 * classeur est lie, et rien ici n'est sensible.
 */
sheetsRouter.get('/config', (_req, res) => {
  res.json({ config: getPublicSheetsConfig(), bootstrapNeeded: !getSheetsConfig().isLinked });
});

const TAB_FIELDS = ['usersTab', 'participantsTab', 'sessionsTab', 'checkInsTab', 'feedbacksTab'] as const;

/** Modifie la configuration : reserve aux roles habilites. */
sheetsRouter.put('/config', requireCapability('canManageIntegrations'), (req: AuthedRequest, res) => {
  const patch: Record<string, unknown> = {};

  for (const field of TAB_FIELDS) {
    const value = req.body?.[field];
    if (typeof value === 'string' && value.trim()) patch[field] = value.trim();
  }

  if (typeof req.body?.autoSync === 'boolean') patch.autoSync = req.body.autoSync;

  // Secrets d'ecriture : acceptes en entree, jamais renvoyes en sortie.
  for (const field of ['writeWebhookUrl', 'appSheetAppId', 'appSheetAccessKey'] as const) {
    const value = req.body?.[field];
    if (typeof value === 'string') patch[field] = value.trim();
  }

  updateSheetsConfig(patch);
  res.json({ config: getPublicSheetsConfig() });
});

/**
 * Relie un classeur : verifie qu'il est lisible et que l'onglet des comptes
 * contient bien des emails, puis charge les comptes.
 */
sheetsRouter.post('/link', requireCapability('canManageIntegrations'), async (req: AuthedRequest, res) => {
  const sheetUrl = typeof req.body?.masterSheetUrl === 'string' ? req.body.masterSheetUrl.trim() : '';

  if (!sheetUrl) {
    return res.status(400).json({ error: 'Renseignez le lien de partage du classeur Google Sheet.' });
  }

  if (!extractSpreadsheetId(sheetUrl)) {
    return res.status(400).json({ error: 'Lien Google Sheets invalide ou identifiant introuvable.' });
  }

  const usersTab =
    typeof req.body?.usersTab === 'string' && req.body.usersTab.trim()
      ? req.body.usersTab.trim()
      : getSheetsConfig().usersTab;

  // On teste avant d'enregistrer `isLinked`, pour ne jamais marquer comme
  // reliee une configuration qui ne fonctionne pas.
  const candidate = { ...getSheetsConfig(), masterSheetUrl: sheetUrl, usersTab };

  try {
    const table = await readTab(usersTab, candidate);
    const accounts = mapUserAccounts(table);

    if (accounts.length === 0) {
      // Google renvoie le premier onglet quand le nom demande n'existe pas :
      // une table sans colonne Email signale souvent un nom d'onglet errone.
      updateSheetsConfig({
        masterSheetUrl: sheetUrl,
        usersTab,
        isLinked: false,
        lastError: `Aucune colonne « Email » exploitable dans l'onglet « ${usersTab} ».`,
      });

      return res.status(422).json({
        error:
          `Aucune colonne « Email » exploitable dans l'onglet « ${usersTab} ». ` +
          `Vérifiez l'orthographe exacte du nom de l'onglet, puis ses colonnes. ` +
          `Colonnes lues : ${table.headers.filter(Boolean).join(', ') || 'aucune'}.`,
        reason: 'no_accounts',
      });
    }

    updateSheetsConfig({
      masterSheetUrl: sheetUrl,
      usersTab,
      isLinked: true,
      lastSyncTimestamp: new Date().toISOString(),
      lastError: undefined,
    });

    replaceAccounts(accounts);

    let sessionsUpdated = 0;
    for (const account of accounts) {
      sessionsUpdated += updateSessionsForEmail(account.email, {
        role: account.role,
        status: account.status,
      });
    }

    res.json({
      config: getPublicSheetsConfig(),
      accounts: accounts.length,
      sessionsUpdated,
      message: `Classeur lié : ${accounts.length} compte(s) détecté(s) dans l'onglet « ${usersTab} ».`,
    });
  } catch (error: any) {
    updateSheetsConfig({ masterSheetUrl: sheetUrl, usersTab, isLinked: false, lastError: error.message });

    const status = error instanceof SheetError ? error.status : 500;
    res.status(status).json({ error: error.message, reason: error instanceof SheetError ? error.reason : 'unknown' });
  }
});

sheetsRouter.post('/unlink', requireCapability('canManageIntegrations'), (_req, res) => {
  updateSheetsConfig({ isLinked: false, lastError: undefined });
  res.json({ config: getPublicSheetsConfig() });
});

/* ------------------------------------------------------------------ *
 * Lecture des donnees
 * ------------------------------------------------------------------ */

const READABLE_TABS = ['participants', 'sessions', 'announcements'] as const;
type ReadableTab = (typeof READABLE_TABS)[number];

function tabNameFor(kind: ReadableTab): string {
  const config = getSheetsConfig();

  switch (kind) {
    case 'participants':
      return config.participantsTab;
    case 'sessions':
      return config.sessionsTab;
    case 'announcements':
      return 'Annonces';
  }
}

/**
 * Lit un onglet nomme par sa CATEGORIE, jamais par une URL fournie par le
 * client. Toute session valide peut lire le programme et les participants.
 */
sheetsRouter.get('/data/:kind', requireAuth, async (req: AuthedRequest, res) => {
  const kind = req.params.kind as ReadableTab;

  if (!READABLE_TABS.includes(kind)) {
    return res.status(400).json({ error: 'Catégorie de données inconnue.' });
  }

  try {
    const table = await readTab(tabNameFor(kind));
    res.json({ headers: table.headers, rows: table.rows, count: table.rows.length });
  } catch (error: any) {
    const status = error instanceof SheetError ? error.status : 500;
    res.status(status).json({ error: error.message, reason: error instanceof SheetError ? error.reason : 'unknown' });
  }
});

/* ------------------------------------------------------------------ *
 * Ecriture des donnees
 * ------------------------------------------------------------------ */

/**
 * Ecrit des presences ou des feedbacks.
 *
 * L'onglet cible est deduit de la categorie, et les lignes sont reconstruites
 * champ par champ : le client ne choisit ni la destination ni la forme des
 * donnees ecrites dans le classeur.
 */
sheetsRouter.post('/append/:kind', requireAuth, async (req: AuthedRequest, res) => {
  const kind = req.params.kind;
  const config = getSheetsConfig();
  const session = req.session!;

  // L'autorisation d'abord : on refuse un rôle non habilité avant même de
  // renseigner sur l'état de la configuration.
  if (kind === 'checkins' && !req.capabilities?.canScan) {
    return res
      .status(403)
      .json({ error: "Votre rôle ne permet pas d'enregistrer des présences.", reason: 'forbidden' });
  }

  if (!config.isLinked) {
    return res.status(409).json({ error: 'Aucun classeur lié.', reason: 'not_linked' });
  }

  if (!hasWriteTarget()) {
    return res.status(409).json({
      error: "Aucune voie d'écriture configurée. Un administrateur doit renseigner un Apps Script ou l'API AppSheet.",
      reason: 'no_write_target',
    });
  }

  const incoming = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (incoming.length === 0) {
    return res.status(400).json({ error: 'Aucune ligne à écrire.' });
  }

  if (incoming.length > 500) {
    return res.status(413).json({ error: 'Trop de lignes en une seule requête (maximum 500).' });
  }

  const text = (value: unknown) => (value === undefined || value === null ? '' : String(value).slice(0, 2000));
  const score = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(5, parsed)) : '';
  };

  let tab: string;
  let rows: Record<string, unknown>[];

  if (kind === 'checkins') {
    tab = config.checkInsTab;
    rows = incoming.map((row: any) => ({
      Horodateur: new Date().toLocaleString('fr-FR'),
      Nom: text(row.participantName),
      Email: text(row.participantEmail),
      Billet: text(row.ticketNumber),
      SessionID: text(row.sessionId),
      Session: text(row.sessionTitle),
      Salle: text(row.room),
      // Toujours l'auteur reel de la requete, pas une valeur envoyee par le client.
      'Scanne par': session.name,
    }));
  } else if (kind === 'feedbacks') {
    tab = config.feedbacksTab;
    rows = incoming.map((row: any) => ({
      Horodateur: new Date().toLocaleString('fr-FR'),
      Session: text(row.sessionTitle),
      Nom: session.name,
      'Note globale': score(row.overallRating),
      'Qualite contenu': score(row.contentQuality),
      'Clarte orateur': score(row.speakerClarity),
      'Utilite pratique': score(row.practicalRelevance),
      Commentaires: text(row.comments),
      Question: text(row.questionForSpeaker),
    }));
  } else {
    return res.status(400).json({ error: 'Catégorie inconnue.' });
  }

  try {
    const result = await writeRows(tab, rows);
    updateSheetsConfig({ lastSyncTimestamp: new Date().toISOString() });
    res.json({ ok: true, ...result });
  } catch (error: any) {
    const status = error instanceof SheetError ? error.status : 500;
    res.status(status).json({ error: error.message, reason: error instanceof SheetError ? error.reason : 'unknown' });
  }
});
