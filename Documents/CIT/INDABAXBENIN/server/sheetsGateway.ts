import {
  buildCsvUrl,
  extractGid,
  extractSpreadsheetId,
  isAllowedGoogleUrl,
  parseCsv,
  SheetTable,
  toTable,
} from '../src/lib/sheets';
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
 * Lit un onglet du classeur configure.
 *
 * Attention : quand le nom d'onglet demande n'existe pas, Google renvoie le
 * PREMIER onglet du classeur au lieu d'une erreur. Les appelants doivent donc
 * valider les colonnes obtenues plutot que de se fier au succes de l'appel.
 */
export async function readTab(tab: string | undefined, config?: ServerSheetsConfig): Promise<SheetTable> {
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

  // Si le lien pointe deja vers un onglet precis (#gid=...), on le respecte,
  // sauf si un nom d'onglet explicite est demande.
  const gid = tab ? null : extractGid(sheets.masterSheetUrl);
  const csvUrl = buildCsvUrl(spreadsheetId, { tab, gid });

  if (!isAllowedGoogleUrl(csvUrl)) {
    throw new SheetError('URL sortante non autorisée.', 400, 'blocked_host');
  }

  const response = await fetchWithTimeout(csvUrl);

  if (!response.ok) {
    throw new SheetError(
      response.status === 404
        ? `Onglet « ${tab || 'par défaut'} » introuvable dans le classeur.`
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

/** Ecrit des lignes dans un onglet, via Apps Script ou l'API AppSheet. */
export async function writeRows(
  table: string,
  rows: Record<string, unknown>[],
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

    const response = await fetchWithTimeout(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, rows }),
    });

    if (!response.ok) {
      throw new SheetError(`Le Apps Script a répondu HTTP ${response.status}.`, 502, 'webhook_error');
    }

    return { via: 'apps-script', written: rows.length };
  }

  // Voie 2 : API AppSheet.
  const appId = config.appSheetAppId.trim();
  const accessKey = config.appSheetAccessKey.trim();

  if (appId && accessKey) {
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
