import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCopy,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Link2,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Unlink,
  Upload,
  X,
} from 'lucide-react';
import { useEvent } from '../context/EventContext';
import { APPS_SCRIPT_SNIPPET, SHEET_TEMPLATE_HEADERS } from '../services/sheetsDb';
import { DocLink, DocLinkKind } from '../types';

type Panel = 'database' | 'write' | 'documents';

interface SheetsSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DOC_KINDS: { value: DocLinkKind; label: string }[] = [
  { value: 'doc', label: 'Google Doc' },
  { value: 'sheet', label: 'Google Sheet' },
  { value: 'slides', label: 'Google Slides' },
  { value: 'form', label: 'Google Form' },
  { value: 'drive', label: 'Dossier Drive' },
  { value: 'other', label: 'Autre lien' },
];

/**
 * Configuration de la base de donnees : uniquement des LIENS.
 *
 * La configuration est enregistree sur le SERVEUR. Les secrets d'ecriture
 * (URL Apps Script, cle AppSheet) ne redescendent jamais dans le navigateur :
 * les champs correspondants sont en ecriture seule, et laisser un champ vide
 * conserve la valeur deja enregistree.
 */
export const SheetsSetupModal: React.FC<SheetsSetupModalProps> = ({ isOpen, onClose }) => {
  const {
    sheetsConfig,
    saveSheetsSettings,
    isSheetsLinked,
    canWriteToSheets,
    linkSheetsDatabase,
    unlinkSheetsDatabase,
    importFromSheets,
    pushDataToSheets,
    reloadAccountsFromSheet,
    isSyncing,
    userAccounts,
    docLinks,
    saveDocLink,
    removeDocLink,
    capabilities,
  } = useEvent();

  const [panel, setPanel] = useState<Panel>('database');
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Brouillons : on n'ecrit sur le serveur que lorsque l'utilisateur valide.
  const [sheetUrlDraft, setSheetUrlDraft] = useState(sheetsConfig.masterSheetUrl);
  const [tabsDraft, setTabsDraft] = useState({
    usersTab: sheetsConfig.usersTab,
    participantsTab: sheetsConfig.participantsTab,
    sessionsTab: sheetsConfig.sessionsTab,
    checkInsTab: sheetsConfig.checkInsTab,
    feedbacksTab: sheetsConfig.feedbacksTab,
  });
  const [secretsDraft, setSecretsDraft] = useState({
    writeWebhookUrl: '',
    appSheetAppId: '',
    appSheetAccessKey: '',
  });

  const [newLink, setNewLink] = useState<{ label: string; url: string; kind: DocLinkKind }>({
    label: '',
    url: '',
    kind: 'doc',
  });

  if (!isOpen) return null;

  const canManage = capabilities.canManageIntegrations;

  const run = async (action: () => Promise<string>) => {
    setFeedback(null);
    try {
      setFeedback({ kind: 'ok', text: await action() });
    } catch (error: any) {
      setFeedback({ kind: 'error', text: error?.message || 'Opération impossible.' });
    }
  };

  const handleSaveTabs = () =>
    run(async () => {
      await saveSheetsSettings(tabsDraft);
      return "Noms d'onglets enregistrés sur le serveur.";
    });

  const handleSaveSecrets = () =>
    run(async () => {
      // Un champ laisse vide n'ecrase pas la valeur deja enregistree.
      const patch: Record<string, string> = {};
      for (const [key, value] of Object.entries(secretsDraft)) {
        if (value.trim()) patch[key] = value.trim();
      }

      if (Object.keys(patch).length === 0) {
        throw new Error("Renseignez au moins un champ. Un champ vide conserve la valeur enregistrée.");
      }

      await saveSheetsSettings(patch);
      setSecretsDraft({ writeWebhookUrl: '', appSheetAppId: '', appSheetAccessKey: '' });
      return "Voie d'écriture enregistrée sur le serveur.";
    });

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setFeedback({ kind: 'error', text: 'Copie impossible : sélectionnez le script manuellement.' });
    }
  };

  const handleAddDocLink = () => {
    if (!newLink.label.trim() || !newLink.url.trim()) {
      setFeedback({ kind: 'error', text: 'Renseignez un intitulé et un lien.' });
      return;
    }

    saveDocLink({
      id: `doc-${Date.now()}`,
      label: newLink.label.trim(),
      url: newLink.url.trim(),
      kind: newLink.kind,
      visibleTo: 'all',
    });

    setNewLink({ label: '', url: '', kind: 'doc' });
    setFeedback({ kind: 'ok', text: 'Lien ajouté et visible par tous les rôles.' });
  };

  const tabButton = (id: Panel, label: string, Icon: typeof Database) => (
    <button
      onClick={() => setPanel(id)}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
        panel === id
          ? 'bg-emerald-700 text-white shadow-sm'
          : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200/70 dark:hover:bg-stone-800'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );

  const fieldClass =
    'w-full px-3 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition disabled:opacity-60 disabled:cursor-not-allowed';
  const labelClass =
    'text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-1';

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* En-tete */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-amber-700 p-6 text-white relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shadow-md">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase bg-amber-400 text-stone-950 px-2 py-0.5 rounded-full font-bold">
                Base de données
              </span>
              <h2 className="text-xl font-heading font-black">Google Sheet &amp; AppSheet</h2>
            </div>
          </div>

          <p className="text-xs text-emerald-100 max-w-md">
            Le serveur lit et écrit dans un classeur Google Sheet partagé par lien. Aucun projet Google Cloud
            ni Firebase n&apos;est nécessaire.
          </p>
        </div>

        {/* Onglets */}
        <div className="px-6 pt-4 pb-2 flex items-center gap-1.5 border-b border-stone-200 dark:border-stone-800 shrink-0 overflow-x-auto">
          {tabButton('database', 'Classeur & rôles', Database)}
          {tabButton('write', 'Écriture', Upload)}
          {tabButton('documents', 'Documents', FileText)}
        </div>

        {/* Contenu */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {!canManage && (
            <div className="p-3 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl text-[11px] font-semibold text-stone-700 dark:text-stone-300 flex items-start gap-2">
              <Lock className="w-4 h-4 shrink-0 mt-px text-stone-500" />
              <span>
                Votre rôle permet de consulter cette configuration mais pas de la modifier. Le serveur refuserait
                toute modification.
              </span>
            </div>
          )}

          {feedback && (
            <div
              className={`p-3 rounded-2xl text-xs font-semibold flex items-start gap-2 animate-in fade-in ${
                feedback.kind === 'ok'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300'
              }`}
            >
              {feedback.kind === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* ---------------- Panneau : classeur ---------------- */}
          {panel === 'database' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="flex items-center gap-2.5 text-xs">
                  <span className={`w-2.5 h-2.5 rounded-full ${isSheetsLinked ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <div>
                    <p className="font-bold text-stone-900 dark:text-stone-100">
                      {isSheetsLinked ? 'Classeur lié' : 'Aucun classeur lié'}
                    </p>
                    <p className="text-[11px] text-stone-600 dark:text-stone-400">
                      {userAccounts.length} compte(s) sur le serveur
                      {sheetsConfig.lastSyncTimestamp
                        ? ` • dernière lecture ${new Date(sheetsConfig.lastSyncTimestamp).toLocaleString('fr-FR')}`
                        : ''}
                    </p>
                  </div>
                </div>

                {isSheetsLinked && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={sheetsConfig.masterSheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition"
                      title="Ouvrir le classeur"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    {canManage && (
                      <button
                        onClick={() => run(unlinkSheetsDatabase)}
                        className="p-2 text-stone-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition cursor-pointer"
                        title="Délier"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {sheetsConfig.lastError && !isSheetsLinked && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-2xl text-[11px] font-semibold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                  <span>Dernière erreur : {sheetsConfig.lastError}</span>
                </div>
              )}

              <div>
                <label htmlFor="sheet-url" className={labelClass}>
                  Lien du classeur Google Sheet
                </label>
                <div className="relative">
                  <Link2 className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="sheet-url"
                    type="url"
                    disabled={!canManage}
                    value={sheetUrlDraft}
                    onChange={event => setSheetUrlDraft(event.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    className={`${fieldClass} pl-9`}
                  />
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-500 mt-1.5 leading-relaxed">
                  Le classeur doit être partagé en lecture avec « Tous les utilisateurs disposant du lien ». C&apos;est
                  le même classeur que celui utilisé par votre application AppSheet.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(
                  [
                    ['usersTab', 'Onglet comptes'],
                    ['participantsTab', 'Onglet participants'],
                    ['sessionsTab', 'Onglet sessions'],
                    ['checkInsTab', 'Onglet présences'],
                    ['feedbacksTab', 'Onglet feedbacks'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label htmlFor={`tab-${key}`} className={labelClass}>
                      {label}
                    </label>
                    <input
                      id={`tab-${key}`}
                      disabled={!canManage}
                      value={tabsDraft[key]}
                      onChange={event => setTabsDraft(prev => ({ ...prev, [key]: event.target.value }))}
                      className={fieldClass}
                    />
                  </div>
                ))}

                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-[11px] font-bold text-stone-700 dark:text-stone-300 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!canManage}
                      checked={sheetsConfig.autoSync}
                      onChange={event => run(async () => {
                        await saveSheetsSettings({ autoSync: event.target.checked });
                        return event.target.checked
                          ? 'Synchronisation automatique activée.'
                          : 'Synchronisation automatique désactivée.';
                      })}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    Sync automatique
                  </label>
                </div>
              </div>

              {canManage && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => run(() => linkSheetsDatabase(sheetUrlDraft, tabsDraft.usersTab))}
                      disabled={isSyncing || !sheetUrlDraft.trim()}
                      className="flex-1 min-w-[180px] py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                      {isSheetsLinked ? 'Revérifier et relier' : 'Tester et lier le classeur'}
                    </button>

                    <button
                      onClick={handleSaveTabs}
                      disabled={isSyncing}
                      className="py-2.5 px-4 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-50 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      Enregistrer les onglets
                    </button>

                    <button
                      onClick={() => run(reloadAccountsFromSheet)}
                      disabled={isSyncing || !isSheetsLinked}
                      className="py-2.5 px-4 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      Recharger les rôles
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => run(() => importFromSheets('participants'))}
                      disabled={isSyncing || !isSheetsLinked}
                      className="py-2.5 px-3 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed text-stone-800 dark:text-stone-200 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Importer participants
                    </button>
                    <button
                      onClick={() => run(() => importFromSheets('sessions'))}
                      disabled={isSyncing || !isSheetsLinked}
                      className="py-2.5 px-3 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed text-stone-800 dark:text-stone-200 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Importer sessions
                    </button>
                  </div>
                </>
              )}

              {/* Colonnes attendues */}
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-2">
                <p className="text-[11px] font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  Colonnes attendues par onglet
                </p>
                {Object.entries(SHEET_TEMPLATE_HEADERS).map(([tab, headers]) => (
                  <div key={tab} className="text-[10px] leading-relaxed">
                    <span className="font-mono font-bold text-emerald-800 dark:text-emerald-400">{tab}</span>
                    <span className="text-stone-600 dark:text-stone-400"> : {headers.join(' · ')}</span>
                  </div>
                ))}
                <p className="text-[10px] text-stone-500 pt-1 border-t border-stone-200 dark:border-stone-700">
                  Les intitulés sont tolérants aux accents et aux variantes (Email / Adresse email, Rôle / Fonction…).
                  Seule la colonne <strong>Email</strong> est indispensable dans l&apos;onglet des comptes. Si son nom
                  est mal orthographié, Google renvoie le premier onglet du classeur : la liaison échouera en
                  signalant les colonnes réellement lues.
                </p>
              </div>
            </div>
          )}

          {/* ---------------- Panneau : ecriture ---------------- */}
          {panel === 'write' && (
            <div className="space-y-5">
              <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-center gap-2.5 text-xs">
                <span className={`w-2.5 h-2.5 rounded-full ${canWriteToSheets ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <p className="font-bold text-stone-900 dark:text-stone-100">
                  {canWriteToSheets
                    ? `Écriture active via ${sheetsConfig.hasWebhook ? 'Apps Script' : 'l’API AppSheet'}.`
                    : "Lecture seule : configurez une voie d'écriture ci-dessous."}
                </p>
              </div>

              <div className="p-3 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl text-[11px] font-semibold text-stone-700 dark:text-stone-300 flex items-start gap-2">
                <Lock className="w-4 h-4 shrink-0 mt-px text-emerald-600" />
                <span>
                  Ces identifiants sont conservés sur le serveur et ne sont jamais renvoyés au navigateur. Laissez un
                  champ vide pour conserver la valeur déjà enregistrée.
                </span>
              </div>

              <div>
                <label htmlFor="apps-script-url" className={labelClass}>
                  URL du Apps Script Web App {sheetsConfig.hasWebhook && '• déjà configurée'}
                </label>
                <input
                  id="apps-script-url"
                  type="url"
                  disabled={!canManage}
                  value={secretsDraft.writeWebhookUrl}
                  onChange={event => setSecretsDraft(prev => ({ ...prev, writeWebhookUrl: event.target.value }))}
                  placeholder={
                    sheetsConfig.hasWebhook
                      ? '•••••••• (enregistrée — saisir pour remplacer)'
                      : 'https://script.google.com/macros/s/…/exec'
                  }
                  className={fieldClass}
                />
                <p className="text-[11px] text-stone-500 mt-1.5 leading-relaxed">
                  Dans le classeur : <strong>Extensions › Apps Script</strong>, collez le script ci-dessous, puis
                  <strong> Déployer › Application web</strong> (accès : tout le monde) et copiez l&apos;URL obtenue.
                </p>
              </div>

              <div className="rounded-2xl border border-stone-200 dark:border-stone-700 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-stone-100 dark:bg-stone-800">
                  <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                    Script à coller dans le classeur
                  </span>
                  <button
                    onClick={handleCopySnippet}
                    className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ClipboardCopy className="w-3.5 h-3.5" />
                    {copied ? 'Copié !' : 'Copier'}
                  </button>
                </div>
                <pre className="p-3 text-[10px] leading-relaxed bg-stone-950 text-emerald-200 overflow-x-auto max-h-48">
                  {APPS_SCRIPT_SNIPPET}
                </pre>
              </div>

              <div className="pt-2 border-t border-stone-200 dark:border-stone-800 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
                  Ou via l&apos;API AppSheet {sheetsConfig.hasAppSheetApi && '• déjà configurée'}
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="appsheet-id" className={labelClass}>
                      App ID
                    </label>
                    <input
                      id="appsheet-id"
                      disabled={!canManage}
                      value={secretsDraft.appSheetAppId}
                      onChange={event => setSecretsDraft(prev => ({ ...prev, appSheetAppId: event.target.value }))}
                      placeholder={sheetsConfig.hasAppSheetApi ? '•••••••• (enregistré)' : 'xxxxxxxx-xxxx-xxxx…'}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="appsheet-key" className={labelClass}>
                      Application Access Key
                    </label>
                    <input
                      id="appsheet-key"
                      type="password"
                      disabled={!canManage}
                      value={secretsDraft.appSheetAccessKey}
                      onChange={event => setSecretsDraft(prev => ({ ...prev, appSheetAccessKey: event.target.value }))}
                      placeholder={sheetsConfig.hasAppSheetApi ? '•••••••• (enregistrée)' : 'V2-…'}
                      className={fieldClass}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Dans AppSheet : <strong>Manage › Integrations › IN</strong>, activez l&apos;API et copiez la clé. Les
                  noms d&apos;onglets ci-dessus doivent correspondre aux noms de tables AppSheet.
                </p>
              </div>

              {canManage && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleSaveSecrets}
                    disabled={isSyncing}
                    className="flex-1 min-w-[180px] py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Enregistrer la voie d&apos;écriture
                  </button>

                  <button
                    onClick={() => run(pushDataToSheets)}
                    disabled={isSyncing || !isSheetsLinked || !canWriteToSheets}
                    className="flex-1 min-w-[180px] py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Envoyer les données en attente
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ---------------- Panneau : documents ---------------- */}
          {panel === 'documents' && (
            <div className="space-y-4">
              <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                Ajoutez les liens Google Doc, Slides ou Form que les participants doivent pouvoir ouvrir depuis
                l&apos;application (programme, code de conduite, guide des conférenciers…).
              </p>

              <div className="space-y-2">
                {docLinks.length === 0 && <p className="text-xs text-stone-500 italic">Aucun lien enregistré.</p>}

                {docLinks.map(link => (
                  <DocLinkRow
                    key={link.id}
                    link={link}
                    canEdit={canManage}
                    onSave={saveDocLink}
                    onRemove={removeDocLink}
                  />
                ))}
              </div>

              {canManage && (
                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-2.5">
                  <p className="text-[11px] font-bold text-stone-700 dark:text-stone-300">Nouveau lien</p>

                  <input
                    value={newLink.label}
                    onChange={event => setNewLink(prev => ({ ...prev, label: event.target.value }))}
                    placeholder="Intitulé (ex. Programme détaillé)"
                    className={fieldClass}
                  />
                  <input
                    type="url"
                    value={newLink.url}
                    onChange={event => setNewLink(prev => ({ ...prev, url: event.target.value }))}
                    placeholder="https://docs.google.com/document/d/…"
                    className={fieldClass}
                  />

                  <div className="flex gap-2">
                    <select
                      value={newLink.kind}
                      onChange={event => setNewLink(prev => ({ ...prev, kind: event.target.value as DocLinkKind }))}
                      className={fieldClass}
                    >
                      {DOC_KINDS.map(kind => (
                        <option key={kind.value} value={kind.value}>
                          {kind.label}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={handleAddDocLink}
                      className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Ajouter
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pied */}
        <div className="px-6 py-4 border-t border-stone-200 dark:border-stone-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

/** Une ligne editable de la liste des liens documentaires. */
const DocLinkRow: React.FC<{
  link: DocLink;
  canEdit: boolean;
  onSave: (link: DocLink) => void;
  onRemove: (id: string) => void;
}> = ({ link, canEdit, onSave, onRemove }) => {
  const [url, setUrl] = useState(link.url);

  const isDirty = url.trim() !== link.url.trim();

  return (
    <div className="p-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">{link.label}</p>
          {link.description && <p className="text-[10px] text-stone-500 leading-relaxed">{link.description}</p>}
          <p className="text-[10px] text-stone-500 mt-0.5">
            {link.visibleTo === 'all' ? 'Visible par tous' : `Visible par : ${link.visibleTo.join(', ')}`}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {link.url.trim() && (
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition"
              title="Ouvrir"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {canEdit && (
            <button
              onClick={() => onRemove(link.id)}
              className="p-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition cursor-pointer"
              title="Supprimer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={event => setUrl(event.target.value)}
            placeholder="Collez le lien Google Doc…"
            className="flex-1 px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-[11px] outline-none focus:border-emerald-600 transition"
          />
          {isDirty && (
            <button
              onClick={() => onSave({ ...link, url: url.trim() })}
              className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-[11px] font-bold shrink-0 transition cursor-pointer"
            >
              Enregistrer
            </button>
          )}
        </div>
      )}
    </div>
  );
};
