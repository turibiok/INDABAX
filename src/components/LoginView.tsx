import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MailCheck,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { useEvent } from '../context/EventContext';
import * as api from '../services/api';

/**
 * Écran d'accès : connexion, inscription, mot de passe oublié, et
 * réinitialisation depuis un lien reçu par email.
 *
 * Le rôle n'est jamais choisi ici — il est attribué par l'organisation. Ce que
 * la personne choisit, c'est son mot de passe : personne d'autre ne le connaît.
 */

type Mode = 'signin' | 'register' | 'forgot' | 'reset';

const MIN_LENGTH = 6;

export const LoginView: React.FC = () => {
  const { signInWithEmail, registerWithEmail, isAuthenticating, isSheetsLinked, sheetsConfig, eventConfig } =
    useEvent();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Lien de réinitialisation : le jeton arrive dans l'URL.
  const [resetToken, setResetToken] = useState<string | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('reset');
    if (!token) return;

    setResetToken(token);
    setMode('reset');

    api
      .checkResetToken(token)
      .then(result => setEmail(result.email))
      .catch((err: any) => setError(err?.message || 'Ce lien n’est plus valable.'));
  }, []);

  /** Retire le jeton de l'URL une fois consommé, pour ne pas le laisser traîner. */
  const clearTokenFromUrl = () => {
    window.history.replaceState({}, '', window.location.pathname);
    setResetToken(null);
  };

  const goTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setPassword('');
    setConfirmation('');
  };

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirmation.length > 0 && password !== confirmation;
  const passwordReady = password.length >= MIN_LENGTH && password === confirmation;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err: any) {
      setError(err?.message || 'Opération impossible.');
      if (mode === 'signin') setPassword('');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (mode === 'signin') {
      return run(async () => {
        try {
          await signInWithEmail(email, password);
        } catch (err: any) {
          // Un compte encore à activer mérite mieux qu'un « mot de passe
          // incorrect » : on oriente vers l'inscription.
          if (err?.reason === 'no_password') {
            const status = await api.accountStatus(email).catch(() => null);
            if (status?.needsRegistration) {
              setMode('register');
              setPassword('');
              throw new Error(
                "Ce compte n'a pas encore de mot de passe. Choisissez-en un ci-dessous pour l'activer.",
              );
            }
          }
          throw err;
        }
      });
    }

    if (mode === 'register') {
      return run(() => registerWithEmail(email, password));
    }

    if (mode === 'forgot') {
      return run(async () => {
        const result = await api.forgotPassword(email);
        setNotice(result.message);
      });
    }

    return run(async () => {
      if (!resetToken) throw new Error('Lien de réinitialisation absent.');
      const result = await api.resetPassword(resetToken, password);
      clearTokenFromUrl();
      setMode('signin');
      setNotice(result.message);
    });
  };

  const fieldClass =
    'w-full pl-10 pr-11 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-2xl text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition';
  const labelClass =
    'text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-1.5';

  const HEADINGS: Record<Mode, { badge: string; title: string; intro: string }> = {
    signin: {
      badge: 'Accès participant',
      title: 'Connexion',
      intro:
        "Saisissez l'adresse email de votre inscription et votre mot de passe. Le rôle que l'organisation vous a assigné détermine votre interface.",
    },
    register: {
      badge: 'Première connexion',
      title: 'Choisir mon mot de passe',
      intro:
        "Votre email doit déjà figurer dans la liste des inscrits. Choisissez le mot de passe que vous voulez : personne d'autre ne le connaîtra, pas même les organisateurs.",
    },
    forgot: {
      badge: 'Mot de passe oublié',
      title: 'Recevoir un lien',
      intro:
        "Saisissez votre email : vous recevrez un lien pour choisir un nouveau mot de passe. Le lien est valable une heure et ne fonctionne qu'une fois.",
    },
    reset: {
      badge: 'Nouveau mot de passe',
      title: 'Réinitialisation',
      intro: 'Choisissez votre nouveau mot de passe. Ce lien ne sera plus utilisable ensuite.',
    },
  };

  const heading = HEADINGS[mode];
  const needsPassword = mode === 'signin';
  const needsNewPassword = mode === 'register' || mode === 'reset';
  const emailEditable = mode !== 'reset';

  const submitLabel: Record<Mode, string> = {
    signin: 'Accéder à mon espace',
    register: 'Activer mon compte',
    forgot: 'Envoyer le lien',
    reset: 'Enregistrer le mot de passe',
  };

  const canSubmit =
    !busy &&
    !isAuthenticating &&
    Boolean(email.trim()) &&
    (mode === 'forgot' ||
      (needsPassword && password.length > 0) ||
      (needsNewPassword && passwordReady));

  return (
    <div className="min-h-screen bg-[#FDFCFB] dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col">
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-amber-600 text-white text-xs font-semibold py-2 px-4 text-center">
        <span className="bg-amber-400 text-stone-950 text-[10px] uppercase font-black px-2 py-0.5 rounded mr-2">
          Événement officiel
        </span>
        {eventConfig.eventName} {eventConfig.edition} • {eventConfig.startDate} → {eventConfig.endDate} •{' '}
        {eventConfig.location}
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6 items-stretch">
          {/* Identité de l'événement */}
          <div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-emerald-900 via-emerald-800 to-stone-900 text-white rounded-3xl p-8 shadow-2xl">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 via-amber-500 to-orange-500 p-0.5 shadow-lg mb-5">
                <div className="w-full h-full bg-stone-950 rounded-[14px] flex items-center justify-center">
                  <span className="font-heading font-black text-xl bg-gradient-to-r from-amber-400 to-emerald-400 bg-clip-text text-transparent">
                    IX
                  </span>
                </div>
              </div>

              <h1 className="font-heading font-black text-3xl leading-tight">
                INDABAX <span className="text-amber-400">BÉNIN</span>
              </h1>
              <p className="text-emerald-100 text-sm mt-2 font-medium">
                Deep Learning &amp; IA pour l&apos;Afrique de l&apos;Ouest.
              </p>

              <p className="text-emerald-200/80 text-xs mt-5 leading-relaxed">{eventConfig.themeDescription}</p>
            </div>

            <div className="space-y-3 mt-8">
              <div className="flex items-start gap-3 text-xs">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-emerald-100">
                  Votre <strong className="text-white">rôle est attribué par les organisateurs</strong>.
                  L&apos;interface s&apos;adapte : participant, conférencier, volontaire, organisateur ou
                  administrateur.
                </p>
              </div>
              <div className="flex items-start gap-3 text-xs">
                <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-emerald-100">
                  <strong className="text-white">Vous choisissez votre mot de passe</strong> vous-même, à la première
                  connexion. Les organisateurs ne le connaissent pas et ne peuvent pas le lire.
                </p>
              </div>
            </div>
          </div>

          {/* Formulaire */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col justify-center">
            <div className="md:hidden mb-6 text-center">
              <h1 className="font-heading font-black text-2xl">
                INDABAX <span className="text-amber-600">BÉNIN</span>
              </h1>
            </div>

            <div className="mb-6">
              <span className="text-[10px] font-mono uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-1 rounded-full font-bold">
                {heading.badge}
              </span>
              <h2 className="font-heading font-black text-2xl mt-3">{heading.title}</h2>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-1.5 leading-relaxed">{heading.intro}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className={labelClass}>
                  Adresse email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoFocus={emailEditable}
                    disabled={!emailEditable}
                    autoComplete="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="prenom.nom@exemple.bj"
                    className={`${fieldClass} disabled:opacity-70`}
                  />
                </div>
              </div>

              {needsPassword && (
                <div>
                  <label htmlFor="login-password" className={labelClass}>
                    Mot de passe
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-password"
                      type={visible ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      className={fieldClass}
                    />
                    <button
                      type="button"
                      onClick={() => setVisible(state => !state)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition cursor-pointer"
                      aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {needsNewPassword && (
                <>
                  <div>
                    <label htmlFor="new-password" className={labelClass}>
                      Mot de passe ({MIN_LENGTH} caractères minimum)
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="new-password"
                        type={visible ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                        className={fieldClass}
                      />
                      <button
                        type="button"
                        onClick={() => setVisible(state => !state)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition cursor-pointer"
                        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      >
                        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {tooShort && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 font-bold mt-1">
                        {MIN_LENGTH} caractères minimum.
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="confirm-password" className={labelClass}>
                      Confirmation
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="confirm-password"
                        type={visible ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={confirmation}
                        onChange={event => setConfirmation(event.target.value)}
                        className={fieldClass}
                      />
                    </div>
                    {mismatch && (
                      <p className="text-[11px] text-red-700 dark:text-red-400 font-bold mt-1">
                        Les deux saisies diffèrent.
                      </p>
                    )}
                  </div>
                </>
              )}

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 rounded-2xl text-xs font-semibold flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                  <span>{error}</span>
                </div>
              )}

              {notice && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs font-semibold flex items-start gap-2 animate-in fade-in">
                  {mode === 'forgot' ? (
                    <MailCheck className="w-4 h-4 shrink-0 mt-px" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
                  )}
                  <span>{notice}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-800 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-800/20 transition-all active:scale-98 cursor-pointer"
              >
                {busy || isAuthenticating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Un instant…
                  </>
                ) : (
                  <>
                    {submitLabel[mode]}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Passages entre les parcours */}
            <div className="mt-5 pt-4 border-t border-stone-200 dark:border-stone-800 space-y-2 text-[11px]">
              {mode === 'signin' && (
                <>
                  <button
                    onClick={() => goTo('register')}
                    className="w-full text-left font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Première connexion : choisir mon mot de passe
                  </button>
                  <button
                    onClick={() => goTo('forgot')}
                    className="w-full text-left font-bold text-stone-600 dark:text-stone-400 hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Mot de passe oublié
                  </button>
                </>
              )}

              {mode !== 'signin' && (
                <button
                  onClick={() => {
                    if (resetToken) clearTokenFromUrl();
                    goTo('signin');
                  }}
                  className="w-full text-left font-bold text-stone-600 dark:text-stone-400 hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Revenir à la connexion
                </button>
              )}
            </div>

            {/* État de la base */}
            <div className="mt-5 pt-4 border-t border-stone-200 dark:border-stone-800 space-y-2.5">
              <div className="flex items-center gap-2 text-[11px]">
                <span className={`w-2 h-2 rounded-full ${isSheetsLinked ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="font-bold text-stone-700 dark:text-stone-300">
                  {isSheetsLinked
                    ? `Base liée • onglet « ${sheetsConfig.profilesTab} »`
                    : 'Aucun classeur lié — table locale du serveur'}
                </span>
              </div>

              <p className="text-[11px] text-stone-500 dark:text-stone-500 flex items-start gap-1.5 leading-relaxed">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-px" />
                Email non reconnu ? Écrivez à{' '}
                <a
                  href={`mailto:${eventConfig.contactEmail}`}
                  className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline"
                >
                  {eventConfig.contactEmail}
                </a>{' '}
                pour être ajouté à la liste des inscrits.
              </p>

              {!isSheetsLinked && (
                <p className="text-[11px] text-stone-500 dark:text-stone-500 flex items-start gap-1.5 leading-relaxed">
                  <Database className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-px" />
                  <span>
                    <strong>Première installation ?</strong> Renseignez{' '}
                    <code className="font-mono">SUPERADMIN_EMAIL</code> et{' '}
                    <code className="font-mono">SUPERADMIN_PASSWORD</code> côté serveur, connectez-vous, puis liez le
                    classeur depuis l&apos;espace Super-Admin.
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
