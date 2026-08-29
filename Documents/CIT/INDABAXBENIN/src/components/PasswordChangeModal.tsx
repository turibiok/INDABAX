import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, X } from 'lucide-react';
import { useEvent } from '../context/EventContext';

interface PasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MIN_LENGTH = 6;

/**
 * Changement de son propre mot de passe.
 *
 * Le mot de passe actuel est exigé par le serveur : un cookie de session volé
 * ne suffit pas à verrouiller le compte de quelqu'un d'autre.
 */
export const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({ isOpen, onClose }) => {
  const { changeMyPassword, authSession } = useEvent();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = confirmation.length > 0 && next !== confirmation;
  const canSubmit = current.length > 0 && next.length >= MIN_LENGTH && next === confirmation && !isWorking;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsWorking(true);
    setFeedback(null);

    try {
      const message = await changeMyPassword(current, next);
      setFeedback({ kind: 'ok', text: message });
      setCurrent('');
      setNext('');
      setConfirmation('');
    } catch (error: any) {
      setFeedback({ kind: 'error', text: error?.message || 'Modification impossible.' });
    } finally {
      setIsWorking(false);
    }
  };

  const fieldClass =
    'w-full pl-10 pr-11 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition';
  const labelClass =
    'text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-1.5';

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-emerald-900 p-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-heading font-black">Mon mot de passe</h2>
              <p className="text-[11px] text-stone-300">{authSession?.email}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

          <div>
            <label htmlFor="pwd-current" className={labelClass}>
              Mot de passe actuel
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="pwd-current"
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                value={current}
                onChange={event => setCurrent(event.target.value)}
                className={fieldClass}
              />
              <button
                type="button"
                onClick={() => setVisible(state => !state)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition cursor-pointer"
                aria-label={visible ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
              >
                {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="pwd-new" className={labelClass}>
              Nouveau mot de passe
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="pwd-new"
                type={visible ? 'text' : 'password'}
                autoComplete="new-password"
                value={next}
                onChange={event => setNext(event.target.value)}
                className={fieldClass}
              />
            </div>
            {tooShort && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-bold mt-1">
                {MIN_LENGTH} caractères minimum.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="pwd-confirm" className={labelClass}>
              Confirmation
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="pwd-confirm"
                type={visible ? 'text' : 'password'}
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

          <p className="text-[11px] text-stone-500 leading-relaxed">
            Votre nouveau mot de passe est enregistré sur le serveur sous forme d&apos;empreinte et remplace celui du
            classeur pour vos prochaines connexions.
          </p>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
            >
              {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Modifier
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
