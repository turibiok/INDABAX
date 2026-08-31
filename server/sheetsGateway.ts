import {
  buildCsvUrl,
  buildHtmlViewUrl,
  extractGid,
  extractGidsFromHtml,
  extractSpreadsheetId,
  isAllowedGoogleUrl,
  parseCsv,
  parseTabRef,
  scoreHeaders,
  SheetTable,
  toTable,
} from '../src/lib/sheets';
import { SHEET_TEMPLATES } from '../src/data/sheetTemplates';
import { getSheetsConfig, ServerSheetsConfig } from './store';

/**
 * Acces au classeur Google Sheet.
 *
 * Le lien du classeur vient TOUJOURS de la configuration serveur, jamais du
 * corps de la requete : un client ne peut donc pas rediriger l'application
 * vers un classeur qu'il controle pour s'attribuer un role.
 */

const FETCH_TIMEOUT_MS = 15000;

export class SheetError extends Error {
  status: number;
  reason?: string;

  constructor(message: string, status = 500, reason?: string) {
    super(message);
    this.name = 'SheetError';
    this.status = status;
    this.reason = reason;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new SheetError('Le classeur ne répond pas (délai dépassé).', 504, 'timeout');
    }
    throw new SheetError(`Appel au classeur impossible : ${error.message}`, 502, 'network');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Colonnes attendues par categorie d'onglet, reprises des modeles montres aux
 * organisateurs : la reconnaissance d'un onglet et la documentation ne peuvent
 * donc pas divulguer.
 */
export type TabKind =
  | 'profiles'
  | 'sessions'
  | 'checkins'
  | 'feedbacks'
  | 'announcements'
  | 'messages';

const TEMPLATE_BY_KIND: Record<TabKind, string> = {
  profiles: 'Participants',
  sessions: 'Sessions',
  checkins: 'Check-ins',
  feedbacks: 'Feedbacks',
  announcements: 'Annonces',
  messages: 'Messages',
};

export function expectedHeadersFor(kind: TabKind): string[] {
  const template = SHEET_TEMPLATES.find(item => item.tab === TEMPLATE_BY_KIND[kind]);
  return template ? template.headers : [];
}

/** Recupere une table CSV a une adresse d'onglet donnee. */
async function fetchTable(
  spreadsheetId: string,
  target: { tab?: string; gid?: string | null },
  label: string,
): Promise<SheetTable> {
  const csvUrl = buildCsvUrl(spreadsheetId, target);

  if (!isAllowedGoogleUrl(csvUrl)) {
    throw new SheetError('URL sortante non autorisée.', 400, 'blocked_host');
  }

  const response = await fetchWithTimeout(csvUrl);

  if (!response.ok) {
    throw new SheetError(
      response.status === 404
        ? `Onglet « ${label} » introuvable dans le classeur.`
        : `Le classeur n'est pas accessible (HTTP ${response.status}). Vérifiez qu'il est partagé en lecture avec « Tous les utilisateurs disposant du lien ».`,
      502,
      'unreachable',
    );
  }

  const body = await response.text();
  const head = body.trimStart().slice(0, 20).toLowerCase();

  if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
    throw new SheetError(
      'Le classeur a répondu une page de connexion : partagez-le en lecture avec « Tous les utilisateurs disposant du lien ».',
      502,
      'not_shared',
    );
  }

  return toTable(parseCsv(body));
}

/** Adresses d'onglets déjà résolues, par classeur et par nom demandé. */
const resolvedGids = new Map<string, string>();

/**
 * Deux seuils, parce que deux questions differentes se posent.
 *
 * `STRONG_MATCH` decide si l'onglet rendu par son nom est le bon, sans rien
 * verifier d'autre. Il doit etre eleve : les modeles partagent beaucoup de
 * colonnes — `Participants` retrouve 5 des 8 colonnes de `Utilisateurs`, soit
 * 0,62 — et un seuil bas ferait accepter le mauvais onglet, ce qui est
 * precisement le defaut que cette resolution corrige.
 *
 * `MIN_MATCH` sert quand tous les onglets ont ete compares entre eux : le
 * meilleur gagne, et ce plancher ne fait qu'ecarter un classeur qui ne
 * contient rien de ressemblant.
 */
const STRONG_MATCH = 0.85;
const MIN_MATCH = 0.5;

/** Liste les gid des onglets d'un classeur. */
async function discoverGids(spreadsheetId: string): Promise<string[]> {
  const response = await fetchWithTimeout(buildHtmlViewUrl(spreadsheetId));
  if (!response.ok) return [];

  return extractGidsFromHtml(await response.text());
}

/**
 * Lit un onglet du classeur configure.
 *
 * Deux pieges de Google sont traites ici.
 *
 * D'une part, un nom d'onglet inexistant ne provoque pas d'erreur : le premier
 * onglet du classeur est renvoye a sa place. D'autre part, sur un classeur
 * simplement partage par lien — et non publie — le parametre `sheet=` est
 * purement ignore, si bien que TOUS les noms renvoient l'onglet par defaut.
 *
 * `expectedHeaders` permet donc de verifier qu'on a bien l'onglet voulu. En cas
 * de desaccord, les onglets du classeur sont parcourus par leur gid et celui
 * dont les colonnes correspondent est retenu, puis memorise.
 */
export async function readTab(
  tab: string | undefined,
  config?: ServerSheetsConfig,
  expectedHeaders?: string[],
): Promise<SheetTable> {
  const sheets = config || getSheetsConfig();

  if (!sheets.masterSheetUrl.trim()) {
    throw new SheetError(
      'Aucun classeur Google Sheet configuré sur le serveur.',
      409,
      'not_configured',
    );
  }

  const spreadsheetId = extractSpreadsheetId(sheets.masterSheetUrl);
  if (!spreadsheetId) {
    throw new SheetError('Le lien du classeur enregistré est invalide.', 400, 'bad_link');
  }

  // Aucun onglet demandé : on suit le lien tel quel, gid inclus s'il en porte un.
  if (!tab) {
    return fetchTable(spreadsheetId, { gid: extractGid(sheets.masterSheetUrl) }, 'par défaut');
  }

  // L'onglet peut être désigné par son gid, ou par l'URL de l'onglet.
  const ref = parseTabRef(tab);
  if ('gid' in ref) {
    return fetchTable(spreadsheetId, { gid: ref.gid }, `gid ${ref.gid}`);
  }

  const cacheKey = `${spreadsheetId}:${ref.tab}`;
  const cachedGid = resolvedGids.get(cacheKey);
  if (cachedGid) {
    return fetchTable(spreadsheetId, { gid: cachedGid }, ref.tab);
  }

  const byName = await fetchTable(spreadsheetId, { tab: ref.tab }, ref.tab);

  // Sans colonnes attendues, on ne peut rien vérifier : on rend ce qui vient.
  if (!expectedHeaders || expectedHeaders.length === 0) return byName;

  if (scoreHeaders(byName.headers, expectedHeaders) >= STRONG_MATCH) return byName;

  // Le nom n'a pas été honoré : on identifie l'onglet à ses colonnes.
  const gids = await discoverGids(spreadsheetId);
  let best: { gid: string; table: SheetTable; score: number } | null = null;

  for (const gid of gids) {
    let table: SheetTable;
    try {
      table = await fetchTable(spreadsheetId, { gid }, `gid ${gid}`);
    } catch {
      continue;
    }

    const score = scoreHeaders(table.headers, expectedHeaders);
    if (!best || score > best.score) best = { gid, table, score };
  }

  if (best && best.score >= MIN_MATCH) {
    resolvedGids.set(cacheKey, best.gid);
    console.log(
      `Onglet « ${ref.tab} » identifié par ses colonnes : gid ${best.gid} ` +
        `(${Math.round(best.score * 100)} % de correspondance).`,
    );
    return best.table;
  }

  throw new SheetError(
    `Aucun onglet du classeur ne correspond à « ${ref.tab} ». Colonnes attendues : ` +
      `${expectedHeaders.join(', ')}. Colonnes lues dans l'onglet par défaut : ` +
      `${byName.headers.filter(Boolean).join(', ') || 'aucune'}. ` +
      `Vérifiez le nom de l'onglet, ou renseignez son gid à la place du nom.`,
    422,
    'tab_not_found',
  );
}

/** Vide le cache de résolution des onglets (changement de configuration). */
export function forgetResolvedTabs(): void {
  resolvedGids.clear();
}

/**
 * Envoie un email via le Apps Script du classeur.
 *
 * Le script tourne sous le compte Google propriétaire du classeur : l'envoi ne
 * demande donc aucun service tiers ni clé supplémentaire. En contrepartie, le
 * quota d'envoi de ce compte s'applique, et le script doit avoir été autorisé
 * à envoyer des mails lors de son déploiement.
 */
/** Dit si un Apps Script est configuré, donc si un email peut être envoyé. */
export function isMailerConfigured(): boolean {
  return getSheetsConfig().writeWebhookUrl.trim().length > 0;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ sent: true }> {
  const webhookUrl = getSheetsConfig().writeWebhookUrl.trim();

  if (!webhookUrl) {
    throw new SheetError(
      "Aucun Apps Script n'est configuré : l'application ne peut pas envoyer d'email.",
      409,
      'no_mailer',
    );
  }

  if (!isAllowedGoogleUrl(webhookUrl)) {
    throw new SheetError("L'URL du Apps Script enregistrée est invalide.", 400, 'bad_webhook');
  }

  const response = await fetchWithTimeout(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'email', to: input.to, subject: input.subject, body: input.body }),
  });

  const body = await response.text();
  const head = body.trimStart().slice(0, 200).toLowerCase();

  if (!response.ok || head.startsWith('<!doctype html') || head.startsWith('<html')) {
    throw new SheetError(
      "Le Apps Script n'a pas pu envoyer l'email. Vérifiez que le déploiement est accessible à " +
        '« Tout le monde » et qu\'il a été autorisé à envoyer des mails.',
      502,
      'mailer_unreachable',
    );
  }

  let parsed: { ok?: boolean; error?: string; unsupported?: boolean } | null = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new SheetError(
      `Réponse illisible du Apps Script : ${body.slice(0, 200)}`,
      502,
      'mailer_bad_response',
    );
  }

  // Un script d'une version antérieure ne connaît pas l'action « email ».
  if (parsed?.unsupported) {
    throw new SheetError(
      "Le Apps Script déployé ne sait pas envoyer d'email : recollez la version fournie par " +
        "l'application, puis redéployez-la.",
      409,
      'mailer_outdated',
    );
  }

  if (parsed?.ok !== true) {
    throw new SheetError(
      `Le Apps Script a signalé un échec d'envoi : ${parsed?.error || body.slice(0, 200)}`,
      502,
      'mailer_error',
    );
  }

  return { sent: true };
}

export interface WriteOptions {
  /**
   * Colonne servant de cle. Quand elle est fournie, une ligne dont la cle
   * existe deja est mise a jour au lieu d'etre ajoutee : c'est ce qui permet
   * de tenir une seule ligne par personne dans l'onglet des profils.
   *
   * Seules les colonnes presentes dans la ligne envoyee sont touchees ; les
   * autres cellules de la ligne existante sont laissees telles quelles.
   */
  keyColumn?: string;
}

/** Ecrit des lignes dans un onglet, via Apps Script ou l'API AppSheet. */
export async function writeRows(
  table: string,
  rows: Record<string, unknown>[],
  options: WriteOptions = {},
): Promise<{ via: 'apps-script' | 'appsheet'; written: number }> {
  const config = getSheetsConfig();

  if (rows.length === 0) {
    throw new SheetError('Aucune ligne à écrire.', 400, 'empty');
  }

  // Voie 1 : Apps Script Web App deploye sur le classeur.
  const webhookUrl = config.writeWebhookUrl.trim();
  if (webhookUrl) {
    if (!isAllowedGoogleUrl(webhookUrl)) {
      throw new SheetError(
        "L'URL du Apps Script enregistrée doit être un lien script.google.com en HTTPS.",
        400,
        'bad_webhook',
      );
    }

    if (webhookUrl.includes('/dev')) {
      throw new SheetError(
        "L'URL du Apps Script se termine par « /dev », qui n'est accessible qu'à son auteur connecté. " +
          'Déployez le script en « Application web » et utilisez l’URL en « /exec ».',
        400,
        'dev_url',
      );
    }

    const response = await fetchWithTimeout(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, rows, keyColumn: options.keyColumn }),
    });

    if (!response.ok) {
      throw new SheetError(`Le Apps Script a répondu HTTP ${response.status}.`, 502, 'webhook_error');
    }

    // Le code HTTP ne suffit pas. Un déploiement qui n'est pas accessible à
    // « Tout le monde » redirige vers la page de connexion Google, laquelle
    // répond 200 avec du HTML : sans cette vérification, l'application
    // annoncerait une écriture réussie alors que rien n'a été écrit.
    const body = await response.text();
    const head = body.trimStart().slice(0, 200).toLowerCase();

    if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
      const looksLikeLogin = /accounts\.google\.com|connexion|sign in|authorization/i.test(body.slice(0, 4000));

      throw new SheetError(
        looksLikeLogin
          ? "Le Apps Script a renvoyé une page de connexion Google : le déploiement n'est pas accessible à " +
            '« Tout le monde ». Ouvrez le script, puis Déployer › Gérer les déploiements › modifier, et réglez ' +
            '« Qui a accès » sur « Tout le monde ».'
          : "Le Apps Script a renvoyé une page HTML au lieu de sa réponse JSON : vérifiez que le script déployé " +
            'est bien celui fourni par l’application.',
        502,
        'webhook_not_public',
      );
    }

    let parsed: {
      ok?: boolean;
      written?: number;
      error?: string;
      sheet?: string;
      created?: boolean;
    } | null = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new SheetError(
        `Le Apps Script a renvoyé une réponse illisible : ${body.slice(0, 200)}`,
        502,
        'webhook_bad_response',
      );
    }

    if (!parsed || parsed.ok !== true) {
      throw new SheetError(
        `Le Apps Script a signalé un échec : ${parsed?.error || body.slice(0, 200)}`,
        502,
        'webhook_error',
      );
    }

    // Un onglet fraichement cree signifie que le script n'a pas trouve celui
    // attendu : les lignes partent alors dans un doublon, a cote de l'onglet
    // que l'organisateur regarde. Mieux vaut le dire que de laisser chercher.
    if (parsed.created) {
      throw new SheetError(
        `Le Apps Script n'a trouvé aucun onglet nommé « ${table} » et en a créé un nouveau. ` +
          `Renommez votre onglet en « ${table} », ou remplacez le script par la version ` +
          `fournie par l'application, qui retrouve l'onglet malgré les accents, la casse et ` +
          `les espaces. Pensez à supprimer l'onglet en double.`,
        409,
        'sheet_created',
      );
    }

    return { via: 'apps-script', written: parsed.written ?? rows.length };
  }

  // Voie 2 : API AppSheet.
  const appId = config.appSheetAppId.trim();
  const accessKey = config.appSheetAccessKey.trim();

  if (appId && accessKey) {
    // « Add » ajoute toujours une ligne : l'utiliser pour une mise a jour
    // dupliquerait la personne au lieu de corriger sa ligne. Mieux vaut
    // refuser que de laisser deux lignes se contredire.
    if (options.keyColumn) {
      throw new SheetError(
        "La mise à jour d'une ligne existante demande un Apps Script : l'API AppSheet configurée ne " +
          'sait ici qu’ajouter des lignes. Renseignez l’URL du Apps Script du classeur.',
        409,
        'upsert_unsupported',
      );
    }

    const url = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(appId)}/tables/${encodeURIComponent(table)}/Action`;

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ApplicationAccessKey: accessKey },
      body: JSON.stringify({ Action: 'Add', Properties: { Locale: 'fr-FR' }, Rows: rows }),
    });

    if (!response.ok) {
      throw new SheetError(`AppSheet a répondu HTTP ${response.status}.`, 502, 'appsheet_error');
    }

    return { via: 'appsheet', written: rows.length };
  }

  throw new SheetError(
    "Aucune voie d'écriture configurée. Renseignez l'URL d'un Apps Script Web App ou les identifiants AppSheet.",
    409,
    'no_write_target',
  );
}
