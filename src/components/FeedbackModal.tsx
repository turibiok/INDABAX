import React, { useState } from 'react';
import { 
  Star, 
  X, 
  Send, 
  CheckCircle2, 
  MessageSquare, 
  FileSpreadsheet, 
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { Session } from '../types';
import { useEvent } from '../context/EventContext';

export const FeedbackModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
}> = ({ isOpen, onClose, session }) => {
  const { currentUser, submitFeedback, feedbacks, isSheetsLinked, canWriteToSheets } = useEvent();

  const [overallRating, setOverallRating] = useState(5);
  const [contentQuality, setContentQuality] = useState(5);
  const [speakerClarity, setSpeakerClarity] = useState(5);
  const [practicalRelevance, setPracticalRelevance] = useState(5);
  const [comments, setComments] = useState('');
  const [questionForSpeaker, setQuestionForSpeaker] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  if (!isOpen || !session) return null;

  const sessionFeedbacks = feedbacks.filter(f => f.sessionId === session.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comments.trim()) {
      alert("Veuillez saisir un court commentaire sur la session.");
      return;
    }

    setIsSubmitting(true);
    await submitFeedback({
      sessionId: session.id,
      sessionTitle: session.title,
      participantId: currentUser.id,
      participantName: currentUser.name,
      overallRating,
      contentQuality,
      speakerClarity,
      practicalRelevance,
      comments: comments.trim(),
      questionForSpeaker: questionForSpeaker.trim() || undefined,
    });

    setIsSubmitting(false);
    setSubmittedSuccess(true);
    setTimeout(() => {
      setSubmittedSuccess(false);
      onClose();
    }, 2000);
  };

  const StarRatingSelector: React.FC<{
    label: string;
    value: number;
    onChange: (val: number) => void;
  }> = ({ label, value, onChange }) => {
    return (
      <div className="flex items-center justify-between text-xs py-1.5 border-b border-stone-100 last:border-0">
        <span className="text-stone-700 font-semibold">{label}</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              type="button"
              key={star}
              onClick={() => onChange(star)}
              className="p-1 text-stone-300 hover:text-amber-500 transition cursor-pointer"
            >
              <Star
                className={`w-4 h-4 ${
                  star <= value ? 'text-amber-500 fill-amber-500' : 'text-stone-300'
                }`}
              />
            </button>
          ))}
          <span className="ml-2 font-bold text-amber-700 w-4 text-right">{value}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-stone-200 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl animate-in zoom-in-95 my-auto text-stone-800">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 mb-4 border-b border-stone-100">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1">
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              Évaluation de Session
            </div>
            <h3 className="font-heading font-black text-base sm:text-lg text-stone-900 leading-snug">
              {session.title}
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Conférencier : <strong className="text-stone-800">{session.speaker}</strong> ({session.speakerInstitution})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-800 rounded-xl hover:bg-stone-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submittedSuccess ? (
          <div className="py-8 text-center space-y-3 animate-in zoom-in-95">
            <div className="w-14 h-14 bg-emerald-100 border border-emerald-300 rounded-full flex items-center justify-center mx-auto text-emerald-700">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="font-heading font-black text-lg text-stone-900">Merci pour votre retour !</h4>
            <p className="text-xs text-stone-600 max-w-xs mx-auto">
              Votre avis a été enregistré et synchronisé avec les organisateurs IndabaX Bénin.
            </p>
            {isSheetsLinked && canWriteToSheets && (
              <p className="text-[11px] text-emerald-800 font-bold flex items-center justify-center gap-1">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Enregistré dans le classeur Google Sheet
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            
            {/* Criteria Stars */}
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-1">
              <StarRatingSelector
                label="Note Globale de la session"
                value={overallRating}
                onChange={setOverallRating}
              />
              <StarRatingSelector
                label="Qualité et clarté du contenu"
                value={contentQuality}
                onChange={setContentQuality}
              />
              <StarRatingSelector
                label="Pédagogie & Éloquence du Speaker"
                value={speakerClarity}
                onChange={setSpeakerClarity}
              />
              <StarRatingSelector
                label="Pertinence pratique pour vos recherches/travaux"
                value={practicalRelevance}
                onChange={setPracticalRelevance}
              />
            </div>

            {/* Comments */}
            <div>
              <label className="block text-stone-700 font-bold mb-1">
                Votre commentaire / points forts / suggestions : *
              </label>
              <textarea
                rows={3}
                required
                placeholder="Qu'avez-vous particulièrement apprécié ? Que pourrait-on améliorer ?"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-emerald-600"
              />
            </div>

            {/* Question for speaker */}
            <div>
              <label className="block text-stone-700 font-bold mb-1 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                Question pour le conférencier (optionnel) :
              </label>
              <input
                type="text"
                placeholder="Une question restée sans réponse pour la séance Q&R ?"
                value={questionForSpeaker}
                onChange={(e) => setQuestionForSpeaker(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-emerald-600"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-stone-950 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Envoi en cours...' : 'Envoyer mon Feedback'}</span>
              </button>
            </div>

            {/* Community reviews preview */}
            {sessionFeedbacks.length > 0 && (
              <div className="pt-3 border-t border-stone-100">
                <p className="text-[11px] text-stone-500 font-bold uppercase mb-2">
                  Avis récents d'autres participants ({sessionFeedbacks.length}) :
                </p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {sessionFeedbacks.slice(0, 3).map((f) => (
                    <div key={f.id} className="p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-stone-900 text-[11px]">{f.participantName}</span>
                        <div className="flex items-center text-amber-700 text-[10px]">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          <span className="ml-1 font-bold">{f.overallRating}/5</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-stone-600 italic">"{f.comments}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </form>
        )}

      </div>
    </div>
  );
};
