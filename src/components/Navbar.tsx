import React, { useState } from 'react';
import {
  Calendar,
  QrCode,
  User,
  IdCard,
  Users,
  BarChart3,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  Menu,
  X,
  ExternalLink,
  ShieldAlert,
  Layers,
  Bell,
  MessageSquare,
  ShieldCheck,
  LifeBuoy,
  Moon,
  Sun,
  Upload,
  Database,
  LogOut,
  RotateCcw,
  Lock
} from 'lucide-react';
import { useEvent } from '../context/EventContext';
import { AppTab, ROLE_LABELS } from '../permissions';
import { PasswordChangeModal } from './PasswordChangeModal';

export const Navbar: React.FC<{ onOpenScanner: () => void }> = ({ onOpenScanner }) => {
  const {
    activeTab,
    setActiveTab,
    currentUser,
    announcements,
    sheetsConfig,
    isSheetsLinked,
    canWriteToSheets,
    isSyncing,
    pushDataToSheets,
    theme,
    toggleTheme,
    setIsImportModalOpen,
    setIsSheetsSetupOpen,
    capabilities,
    realRole,
    effectiveRole,
    previewRole,
    setPreviewRole,
    refreshMyRole,
    signOut,
    authSession,
  } = useEvent();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  const [roleActionMessage, setRoleActionMessage] = useState<string | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const getRoleDashboardIcon = () => {
    switch (effectiveRole) {
      case 'super-admin':
      case 'organizer':
        return ShieldCheck;
      case 'speaker':
        return Sparkles;
      case 'volunteer':
        return LifeBuoy;
      default:
        return BarChart3;
    }
  };

  // La navigation est entierement derivee du role : un onglet non autorise
  // n'est simplement pas rendu.
  const TAB_META: Record<AppTab, { label: string; icon: typeof Calendar; badge?: number }> = {
    schedule: { label: 'Programme', icon: Calendar },
    announcements: { label: 'Annonces', icon: Bell, badge: announcements.length },
    discussions: { label: 'Discussions', icon: MessageSquare },
    dashboard: { label: capabilities.dashboardLabel, icon: getRoleDashboardIcon() },
    networking: { label: 'Réseautage', icon: Users },
    profile: { label: 'Mon Profil', icon: User },
    badge: { label: 'Mon Badge', icon: IdCard },
    'ai-guide': { label: 'Guide IA', icon: Sparkles },
  };

  const navItems = capabilities.tabs.map(tab => ({ id: tab, ...TAB_META[tab] }));

  const handleRefreshRole = async () => {
    try {
      setRoleActionMessage(await refreshMyRole());
    } catch (error: any) {
      setRoleActionMessage(error?.message || 'Actualisation impossible.');
    }
    setTimeout(() => setRoleActionMessage(null), 4000);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 shadow-xs transition-colors">
      {/* Top micro banner with vibrant palette */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-amber-600 dark:from-emerald-950 dark:via-stone-900 dark:to-amber-950 text-white text-xs font-semibold py-1.5 px-4 text-center flex items-center justify-between">
        <div className="hidden sm:flex items-center gap-2">
          <span className="bg-amber-400 text-stone-950 text-[10px] uppercase font-black px-2 py-0.5 rounded shadow-xs">Événement Officiel</span>
          <span className="text-emerald-50 dark:text-stone-200">IndabaX Bénin 2026 • 18-20 Septembre 2026 • Cotonou, Bénin</span>
        </div>
        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 text-emerald-100 dark:text-stone-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Événement en direct
          </span>
          {isSheetsLinked && sheetsConfig.masterSheetUrl ? (
            <a
              href={sheetsConfig.masterSheetUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:underline font-bold text-amber-300 hover:text-amber-200"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Classeur lié
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ) : capabilities.canManageIntegrations ? (
            <button
              onClick={() => setIsSheetsSetupOpen(true)}
              className="hover:underline font-bold flex items-center gap-1 text-amber-300 hover:text-amber-200 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              Lier le classeur
            </button>
          ) : (
            <span className="flex items-center gap-1 font-bold text-amber-200/80">
              <Database className="w-3.5 h-3.5" />
              Base locale
            </span>
          )}
        </div>
      </div>

      {/* Main navigation bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('schedule')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 via-amber-500 to-orange-500 p-0.5 shadow-md shadow-emerald-700/20 flex items-center justify-center">
              <div className="w-full h-full bg-stone-900 rounded-[10px] flex items-center justify-center">
                <span className="font-heading font-black text-lg bg-gradient-to-r from-amber-400 to-emerald-400 bg-clip-text text-transparent">
                  IX
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-black text-lg tracking-tight text-stone-900 dark:text-white">
                  INDABAX <span className="text-amber-600 dark:text-amber-400">BÉNIN</span>
                </span>
                <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  2026
                </span>
              </div>
              <p className="text-[11px] text-stone-600 dark:text-stone-400 font-medium">Deep Learning & IA pour l'Afrique</p>
            </div>
          </div>

          {/* Desktop Navigation links */}
          <nav className="hidden md:flex items-center gap-1 bg-stone-100/90 dark:bg-stone-800/90 p-1.5 rounded-2xl border border-stone-200 dark:border-stone-700">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-800 dark:bg-emerald-600 text-white shadow-sm font-bold'
                      : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-stone-700'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-stone-500 dark:text-stone-400'}`} />
                  <span>{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span className="text-[9px] bg-red-500 text-white font-bold px-1.5 py-0.2 rounded-full">
                      {item.badge}
                    </span>
                  ) : null}
                  {item.id === 'ai-guide' && (
                    <span className="text-[9px] bg-amber-400 text-stone-950 px-1 py-0.2 rounded font-mono font-bold">Gemini</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Controls: Dark mode toggle, Scan QR, Persona Switcher & Google Sync */}
          <div className="flex items-center gap-2">

            {/* Dark Mode Switcher */}
            <button
              id="theme-toggle-btn"
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 transition cursor-pointer"
              title={theme === 'dark' ? "Passer en mode clair" : "Passer en mode sombre"}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-stone-600" />
              )}
            </button>

            {/* Scanner QR : organisateurs, volontaires et administrateurs */}
            {capabilities.canScan && (
              <button
                id="btn-quick-scan-qr"
                onClick={onOpenScanner}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-800/20 transition-transform active:scale-95 cursor-pointer"
                title="Scanner le QR Code d'un participant pour émarger"
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden sm:inline">Scanner QR</span>
              </button>
            )}

            {/* Etat du classeur & envoi manuel : roles habilites uniquement */}
            {capabilities.canManageIntegrations && (
              <div className="hidden lg:flex items-center">
                {isSheetsLinked ? (
                  <div className="flex items-center gap-2 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 px-2.5 py-1.5 rounded-xl text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-[11px] text-stone-700 dark:text-stone-300 font-medium truncate max-w-[110px]">
                        Classeur lié
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        pushDataToSheets().catch((error: any) =>
                          setRoleActionMessage(error?.message || 'Envoi impossible.'),
                        );
                      }}
                      disabled={isSyncing || !canWriteToSheets}
                      title={
                        canWriteToSheets
                          ? 'Envoyer les présences et feedbacks en attente'
                          : "Aucune voie d'écriture configurée"
                      }
                      className="p-1 hover:bg-white dark:hover:bg-stone-700 text-stone-500 dark:text-stone-400 hover:text-amber-600 disabled:opacity-40 disabled:cursor-not-allowed rounded transition cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-600' : ''}`} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsSheetsSetupOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-700 dark:text-stone-300 transition cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Lier le classeur</span>
                  </button>
                )}
              </div>
            )}

            {/* Profile Avatar / Quick Persona Selector */}
            <div className="relative">
              <button
                id="btn-user-profile-menu"
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 transition cursor-pointer"
              >
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-lg object-cover ring-1 ring-amber-500/60"
                />
                <span className="hidden xl:inline text-xs font-semibold text-stone-800 dark:text-stone-200 truncate max-w-[90px]">
                  {currentUser.name.split(' ')[0]}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                  effectiveRole === 'super-admin'
                    ? 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800'
                    : effectiveRole === 'organizer'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                    : effectiveRole === 'speaker'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                    : 'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300'
                }`}>
                  {ROLE_LABELS[effectiveRole]}
                </span>
              </button>

              {/* Menu du compte connecte */}
              {isRoleDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="p-2 border-b border-stone-100 dark:border-stone-800 mb-1">
                    <p className="text-xs font-bold text-stone-900 dark:text-white">{currentUser.name}</p>
                    <p className="text-[11px] text-stone-600 dark:text-stone-400 truncate">
                      {authSession?.email || currentUser.email}
                    </p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 font-mono font-bold mt-0.5">
                      {currentUser.ticketNumber}
                    </p>

                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                        Rôle attribué : {ROLE_LABELS[realRole]}
                      </span>
                      {authSession?.source === 'sheet' && (
                        <span className="text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 px-2 py-0.5 rounded-full font-bold">
                          via le classeur
                        </span>
                      )}
                    </div>
                  </div>

                  {previewRole && (
                    <div className="mx-1 mb-1 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800">
                      <p className="text-[10px] font-bold text-amber-900 dark:text-amber-200">
                        Prévisualisation « {ROLE_LABELS[previewRole]} » active.
                      </p>
                      <button
                        onClick={() => {
                          setPreviewRole(null);
                          setIsRoleDropdownOpen(false);
                        }}
                        className="mt-1 text-[10px] font-bold text-amber-900 dark:text-amber-200 hover:underline cursor-pointer"
                      >
                        Revenir à mon rôle réel
                      </button>
                    </div>
                  )}

                  {roleActionMessage && (
                    <p className="mx-1 mb-1 p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-[10px] font-semibold text-stone-700 dark:text-stone-300">
                      {roleActionMessage}
                    </p>
                  )}

                  <div className="space-y-1">
                    <button
                      onClick={handleRefreshRole}
                      className="w-full py-1.5 px-3 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold rounded-lg text-left flex items-center gap-2 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Actualiser mon rôle</span>
                    </button>

                    {capabilities.canImportData && (
                      <button
                        onClick={() => {
                          setIsImportModalOpen(true);
                          setIsRoleDropdownOpen(false);
                        }}
                        className="w-full py-1.5 px-3 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold rounded-lg text-left flex items-center gap-2 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-amber-600" />
                        <span>Importer des données</span>
                      </button>
                    )}

                    {capabilities.canManageIntegrations && (
                      <button
                        onClick={() => {
                          setIsSheetsSetupOpen(true);
                          setIsRoleDropdownOpen(false);
                        }}
                        className="w-full py-1.5 px-3 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold rounded-lg text-left flex items-center gap-2 cursor-pointer"
                      >
                        <Database className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Base Google Sheet</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsPasswordModalOpen(true);
                        setIsRoleDropdownOpen(false);
                      }}
                      className="w-full py-1.5 px-3 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold rounded-lg text-left flex items-center gap-2 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Changer mon mot de passe</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('badge');
                        setIsRoleDropdownOpen(false);
                      }}
                      className="w-full py-1.5 px-3 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold rounded-lg text-left flex items-center gap-2 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Mon Badge &amp; Export PDF</span>
                    </button>
                  </div>

                  <div className="pt-2 mt-1 border-t border-stone-100 dark:border-stone-800">
                    <button
                      onClick={() => {
                        setIsRoleDropdownOpen(false);
                        signOut();
                      }}
                      className="w-full py-1.5 px-3 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/70 text-red-700 dark:text-red-300 text-xs font-bold rounded-lg text-left flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Se déconnecter</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 px-4 pt-2 pb-4 space-y-1 shadow-lg">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-emerald-800 dark:bg-emerald-700 text-white font-bold'
                    : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </div>
                {item.id === 'ai-guide' && (
                  <span className="text-[10px] bg-amber-400 text-stone-950 px-2 py-0.5 rounded font-mono font-bold">
                    Gemini AI
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-3 mt-2 border-t border-stone-200 dark:border-stone-800 flex flex-col gap-2">
            {capabilities.canScan && (
              <button
                onClick={() => {
                  onOpenScanner();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                Ouvrir le Scanner QR
              </button>
            )}

            {capabilities.canImportData && (
              <button
                onClick={() => {
                  setIsImportModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-semibold cursor-pointer"
              >
                <Upload className="w-4 h-4 text-amber-600" />
                Importer Données (CSV / JSON)
              </button>
            )}

            {capabilities.canManageIntegrations && (
              <button
                onClick={() => {
                  setIsSheetsSetupOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 bg-stone-100 dark:bg-stone-800 text-emerald-800 dark:text-emerald-400 rounded-xl text-xs font-semibold cursor-pointer"
              >
                <Database className="w-4 h-4" />
                {isSheetsLinked ? 'Gérer la base Google Sheet' : 'Lier la base Google Sheet'}
              </button>
            )}

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                signOut();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl text-xs font-bold cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Se déconnecter
            </button>
          </div>
        </div>
      )}

      <PasswordChangeModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} />
    </header>
  );
};

