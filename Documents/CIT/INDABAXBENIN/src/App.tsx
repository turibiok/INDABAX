import React, { useState } from 'react';
import { EventProvider, useEvent } from './context/EventContext';
import { Navbar } from './components/Navbar';
import { ScheduleView } from './components/ScheduleView';
import { MyBadgeView } from './components/MyBadgeView';
import { NetworkingView } from './components/NetworkingView';
import { RoleDashboardRouter } from './components/RoleDashboards/RoleDashboardRouter';
import { AnnouncementsView } from './components/AnnouncementsView';
import { DiscussionsView } from './components/DiscussionsView';
import { AIChatGuide } from './components/AIChatGuide';
import { QRScannerModal } from './components/QRScannerModal';
import { FeedbackModal } from './components/FeedbackModal';
import { SheetsSetupModal } from './components/SheetsSetupModal';
import { ImportDataModal } from './components/ImportDataModal';
import { LoginView } from './components/LoginView';
import { Session } from './types';
import { AppTab } from './permissions';
import {
  Calendar,
  User,
  Users,
  BarChart3,
  Sparkles,
  QrCode,
  FileSpreadsheet,
  FileText,
  Bell,
  MessageSquare,
  Loader2,
  X,
} from 'lucide-react';

/** Icone et libelle court de chaque onglet, pour la barre mobile. */
const MOBILE_TABS: { id: AppTab; label: string; icon: typeof Calendar }[] = [
  { id: 'schedule', label: 'Prog', icon: Calendar },
  { id: 'announcements', label: 'Annonces', icon: Bell },
  { id: 'discussions', label: 'Chat', icon: MessageSquare },
  { id: 'dashboard', label: 'Espace', icon: BarChart3 },
  { id: 'networking', label: 'Réseau', icon: Users },
  { id: 'badge', label: 'Badge', icon: User },
  { id: 'ai-guide', label: 'Guide IA', icon: Sparkles },
];

const AppContent: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    sheetsConfig,
    isSheetsLinked,
    announcements,
    activeAlerts,
    dismissAlert,
    authStatus,
    authWarning,
    capabilities,
    isSheetsSetupOpen,
    setIsSheetsSetupOpen,
    isImportModalOpen,
    setIsImportModalOpen,
    visibleDocLinks,
    isScannerOpen,
    scannerTargetSession,
    openScanner,
    closeScanner,
  } = useEvent();

  const [feedbackSession, setFeedbackSession] = useState<Session | null>(null);
  const [warningDismissed, setWarningDismissed] = useState(false);

  const handleOpenFeedbackForSession = (session: Session) => {
    setFeedbackSession(session);
  };

  // Le serveur est interroge au demarrage pour savoir si une session existe.
  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#FDFCFB] dark:bg-stone-950 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-700 dark:text-emerald-400" />
        <p className="text-xs font-bold text-stone-600 dark:text-stone-400">Vérification de la session…</p>
      </div>
    );
  }

  // Tant que personne n'est authentifie, seul l'ecran de connexion est accessible.
  // La configuration du classeur exige une session habilitee : le tout premier
  // acces passe par la variable ADMIN_EMAILS du serveur.
  if (authStatus === 'anonymous') {
    return <LoginView />;
  }

  // Un onglet devenu interdit (changement de role en cours de session) retombe
  // sur le premier onglet autorise.
  const allowedTabs = capabilities.tabs;
  const currentTab = allowedTabs.includes(activeTab as AppTab) ? (activeTab as AppTab) : allowedTabs[0];

  const mobileTabs = MOBILE_TABS.filter(tab => allowedTabs.includes(tab.id)).slice(0, 4);

  return (
    <div className="min-h-screen bg-[#FDFCFB] dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col font-sans selection:bg-amber-400 selection:text-stone-950 transition-colors">
      {/* Top Navbar */}
      <Navbar onOpenScanner={() => openScanner()} />

      {/* Avertissement de connexion (repli local, classeur illisible, compte en attente) */}
      {authWarning && !warningDismissed && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-3">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-2xl text-xs font-semibold flex items-start justify-between gap-3">
            <span>{authWarning}</span>
            <button
              onClick={() => setWarningDismissed(true)}
              className="p-1 hover:bg-amber-200/50 dark:hover:bg-amber-900/50 rounded-lg transition cursor-pointer shrink-0"
              aria-label="Masquer l'avertissement"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Rappels temps réel (session qui démarre dans ~15 min) */}
      {activeAlerts.length > 0 && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-3 space-y-2">
          {activeAlerts.map(alert => (
            <div
              key={alert.id}
              className="p-3.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl shadow-lg flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs shrink-0">
                  <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm">
                    Début dans {alert.minutesRemaining} min — {alert.startTime}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-amber-100">
                    {alert.sessionTitle} • {alert.speaker} • {alert.room}
                  </p>
                </div>
              </div>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
              >
                Fermer
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-24 md:pb-12">
        {currentTab === 'schedule' && (
          <ScheduleView
            onOpenScannerForSession={session => openScanner(session)}
            onOpenFeedbackForSession={handleOpenFeedbackForSession}
          />
        )}

        {currentTab === 'announcements' && <AnnouncementsView />}

        {currentTab === 'discussions' && <DiscussionsView />}

        {currentTab === 'dashboard' && <RoleDashboardRouter />}

        {currentTab === 'badge' && <MyBadgeView />}

        {currentTab === 'networking' && <NetworkingView onOpenQRScanner={() => openScanner()} />}

        {currentTab === 'ai-guide' && <AIChatGuide />}
      </main>

      {/* Global Modals */}
      <QRScannerModal isOpen={isScannerOpen} onClose={closeScanner} targetSession={scannerTargetSession} />

      <FeedbackModal
        isOpen={Boolean(feedbackSession)}
        onClose={() => setFeedbackSession(null)}
        session={feedbackSession}
      />

      {/* Configuration de la base Google Sheet (liens uniquement) */}
      <SheetsSetupModal isOpen={isSheetsSetupOpen} onClose={() => setIsSheetsSetupOpen(false)} />

      {/* Import de données en masse (participants, sessions, annonces) */}
      <ImportDataModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-stone-900/95 backdrop-blur-lg border-t border-stone-200 dark:border-stone-800 px-2 py-2 flex items-center justify-around shadow-lg">
        {mobileTabs.slice(0, 2).map(tab => (
          <MobileTabButton
            key={tab.id}
            tab={tab}
            isActive={currentTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            badge={tab.id === 'announcements' ? announcements.length : 0}
          />
        ))}

        {/* Action centrale : scanner, réservé aux rôles habilités */}
        {capabilities.canScan ? (
          <button
            onClick={() => openScanner()}
            className="flex flex-col items-center justify-center -mt-5 w-11 h-11 rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-amber-500 text-white shadow-lg shadow-emerald-700/30 active:scale-90 transition font-black cursor-pointer"
            title="Scanner un QR code"
          >
            <QrCode className="w-5 h-5 text-white" />
          </button>
        ) : (
          <div className="w-11" aria-hidden="true" />
        )}

        {mobileTabs.slice(2).map(tab => (
          <MobileTabButton
            key={tab.id}
            tab={tab}
            isActive={currentTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            badge={tab.id === 'announcements' ? announcements.length : 0}
          />
        ))}
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 py-6 px-4 text-center text-xs text-stone-600 dark:text-stone-400">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-heading font-black text-emerald-800 dark:text-emerald-400 text-sm">
                INDABAX BÉNIN 2026
              </span>
              <span>• Plateforme Inspirée de Baobab Deep Learning Indaba</span>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isSheetsLinked ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {isSheetsLinked ? 'Base Google Sheet liée' : 'Base locale (aucun classeur lié)'}
              </span>
              {isSheetsLinked && sheetsConfig.masterSheetUrl && (
                <a
                  href={sheetsConfig.masterSheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 hover:underline flex items-center gap-1 font-bold"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Ouvrir le classeur
                </a>
              )}
            </div>
          </div>

          {/* Liens documentaires visibles pour ce rôle */}
          {visibleDocLinks.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
              {visibleDocLinks.map(link => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-xl text-[11px] font-bold text-stone-700 dark:text-stone-300 transition"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};

const MobileTabButton: React.FC<{
  tab: { id: AppTab; label: string; icon: typeof Calendar };
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}> = ({ tab, isActive, onClick, badge = 0 }) => {
  const Icon = tab.icon;

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-0.5 text-[10px] font-semibold py-1 px-1.5 rounded-xl transition ${
        isActive
          ? 'text-emerald-800 dark:text-emerald-400 font-bold'
          : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{tab.label}</span>
      {badge > 0 && <span className="absolute top-0 right-1 w-2 h-2 bg-red-500 rounded-full" />}
    </button>
  );
};

export default function App() {
  return (
    <EventProvider>
      <AppContent />
    </EventProvider>
  );
}
