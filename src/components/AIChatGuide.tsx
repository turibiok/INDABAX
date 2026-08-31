import React, { useState } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  Upload, 
  Image as ImageIcon, 
  X, 
  HelpCircle, 
  Lightbulb, 
  Compass, 
  BookOpen,
  MapPin,
  Camera
} from 'lucide-react';
import { useEvent } from '../context/EventContext';

export const AIChatGuide: React.FC = () => {
  const { sessions, participants, currentUser } = useEvent();

  const [messages, setMessages] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    imagePreview?: string;
  }>>([
    {
      role: 'assistant',
      content: `Kouabô ! Bienvenue sur le Guide IA d'IndabaX Bénin 2026. 🌴✨\n\nJe suis là pour vous orienter sur le programme, vous renseigner sur les conférenciers, les ateliers pratiques (NLP Fongbe, Vision, RAG, Éthique) et analyser des photos de posters de recherche.`
    }
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const quickPrompts = [
    "Où et quand a lieu la session sur le NLP & Fongbe ?",
    "Quelles sont les sessions recommandées en Vision & Santé ?",
    "Comment fonctionne l'émargement par scan QR ?",
    "Quels conférenciers de Google Research et Sèmè City sont présents ?",
    "Détails sur le grand Hackathon du Jour 3"
  ];

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputPrompt;
    if (!textToSend.trim() && !selectedImage) return;

    const userMsg = {
      role: 'user' as const,
      content: textToSend,
      imagePreview: selectedImage || undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInputPrompt('');
    const imageToSend = selectedImage;
    setSelectedImage(null);
    setIsLoading(true);

    try {
      if (imageToSend) {
        // Image understanding route
        const res = await fetch('/api/ai/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: imageToSend,
            prompt: textToSend || "Analyse ce poster de recherche ou cette photo de la conférence IndabaX Bénin et résume les points essentiels."
          })
        });
        const data = await res.json();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.text || "Analyse complétée."
        }]);
      } else {
        // Text chat concierge route
        const res = await fetch('/api/ai/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: textToSend,
            context: {
              sessionsCount: sessions.length,
              sessions: sessions.map(s => ({
                id: s.id,
                title: s.title,
                day: s.day,
                time: `${s.startTime}-${s.endTime}`,
                room: s.room,
                speaker: s.speaker,
                track: s.track,
                desc: s.description
              })),
              user: {
                name: currentUser.name,
                role: currentUser.role,
                interests: currentUser.interests
              }
            }
          })
        });

        const data = await res.json();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.text || "Désolé, je n'ai pas pu répondre pour le moment."
        }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Une erreur s'est produite lors de la communication avec l'assistant IA. Veuillez vérifier votre connexion."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-stone-900 via-emerald-950 to-stone-900 border border-stone-800 p-6 rounded-3xl shadow-xl flex items-center justify-between text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-400 p-0.5 shadow-md flex items-center justify-center">
            <div className="w-full h-full bg-stone-950 rounded-[14px] flex items-center justify-center text-amber-400">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>
          <div>
            <h2 className="font-heading font-black text-xl text-white">Guide IA • IndabaX Bénin</h2>
            <p className="text-xs text-stone-300">Assistant intelligent propulsé par Gemini 2.5</p>
          </div>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 min-h-[420px] max-h-[560px] overflow-y-auto">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              m.role === 'user' ? 'bg-amber-400 text-stone-950 font-bold' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed space-y-2 ${
              m.role === 'user' 
                ? 'bg-amber-400 text-stone-950 font-semibold shadow-xs' 
                : 'bg-stone-50 border border-stone-200 text-stone-800'
            }`}>
              {m.imagePreview && (
                <img
                  src={m.imagePreview}
                  alt="Aperçu"
                  className="w-48 h-32 object-cover rounded-xl border border-stone-300 mb-2"
                />
              )}
              <div className="whitespace-pre-line">
                {m.content}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-xs text-stone-600 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
              <span>Recherche dans le programme IndabaX et formulation de la réponse...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Prompt Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <span className="text-[11px] font-bold text-stone-500 shrink-0">Suggestions :</span>
        {quickPrompts.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(q)}
            className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 hover:text-stone-900 rounded-xl text-xs shrink-0 transition cursor-pointer shadow-xs"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Image Preview before sending */}
      {selectedImage && (
        <div className="relative inline-block bg-white p-2 rounded-2xl border border-stone-200 shadow-xs">
          <img src={selectedImage} alt="Preview" className="w-24 h-20 object-cover rounded-xl" />
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="bg-white border border-stone-200 p-2.5 rounded-2xl flex items-center gap-2 shadow-xs"
      >
        <label className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl cursor-pointer transition" title="Analyser une photo de poster ou document">
          <Camera className="w-5 h-5" />
          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        </label>

        <input
          type="text"
          placeholder="Posez une question sur l'événement ou le programme..."
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none"
        />

        <button
          type="submit"
          disabled={isLoading || (!inputPrompt.trim() && !selectedImage)}
          className="p-2.5 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-stone-950 rounded-xl transition cursor-pointer font-bold shadow-xs"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

    </div>
  );
};
