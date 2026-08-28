import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { AuthedRequest, requireAuth, requireCapability } from '../sessions';

export const aiRouter = Router();

/**
 * Assistant IA (Gemini).
 *
 * Toutes ces routes exigent une session : sans cela, la cle Gemini du serveur
 * serait utilisable par n'importe quel visiteur.
 */

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }
  return new GoogleGenAI({ apiKey });
}

const MODEL = 'gemini-2.5-flash';

// Concierge IA : questions sur l'evenement
aiRouter.post('/ask', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { prompt, context } = req.body;
    const ai = getAI();

    const systemInstruction = `Tu es l'assistant officiel de l'événement IndabaX Bénin 2026 (inspiré de la plateforme Baobab du Deep Learning Indaba).
Ton rôle est de guider chaleureusement les participants, chercheurs, conférenciers et organisateurs à Cotonou / Bénin.
Tu fournis des informations précises sur le programme, les sessions de Deep Learning, NLP (notamment sur les langues locales comme le Fongbe, Yoruba), Vision par ordinateur, IA pour la santé et l'agriculture, les ateliers pratiques, les salles (Amphithéâtre Houdégbé, Sèmè One, Lab IA), le networking, et les opportunités de recherche en Afrique.
La personne qui te parle est ${req.session!.name} (rôle : ${req.session!.role}).
Réponds en français fluide, concis, bien structuré et enthousiaste.`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Contexte actuel de l'événement:\n${JSON.stringify(context || {})}\n\nQuestion de l'utilisateur: ${prompt}`,
            },
          ],
        },
      ],
      config: { systemInstruction, temperature: 0.7 },
    });

    res.json({ text: response.text || "Désolé, je n'ai pas pu générer de réponse pour le moment." });
  } catch (error: any) {
    console.error('Error in /api/ai/ask:', error);
    res.status(500).json({ error: 'Erreur lors du traitement de votre demande IA', details: error.message });
  }
});

// Mise en relation : suggestions de networking
aiRouter.post('/matchmake', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { userProfile, attendees } = req.body;
    const ai = getAI();

    const prompt = `Voici le profil d'un participant à IndabaX Bénin:
${JSON.stringify(userProfile)}

Voici la liste des autres participants inscrits:
${JSON.stringify(attendees)}

Analyse les centres d'intérêt, les compétences en IA, les projets de recherche et les objectifs pour recommander les 3 à 4 personnes les plus pertinentes avec qui réseauter.
Pour chaque personne, donne:
1. Le nom
2. Pourquoi ils devraient échanger (points communs et synergies de recherche/projets)
3. Une phrase d'amorce de conversation (icebreaker) personnalisée.

Formatte ta réponse en JSON avec la structure:
{
  "recommendations": [
    {
      "attendeeId": "id",
      "name": "Nom",
      "reason": "Raison de la recommandation",
      "icebreaker": "Question ou phrase suggérée"
    }
  ],
  "summaryTip": "Conseil général pour maximiser son networking à IndabaX Bénin"
}`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' },
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error('Error in /api/ai/matchmake:', error);
    res.status(500).json({ error: 'Erreur lors du matchmaking IA', details: error.message });
  }
});

// Analyse d'image : posters, photos, badges
aiRouter.post('/analyze-image', requireAuth, async (req, res) => {
  try {
    const {
      imageBase64,
      mimeType = 'image/jpeg',
      prompt = "Analyse ce poster de recherche ou cette photo de l'événement IndabaX Bénin et résume les points clés.",
    } = req.body;

    if (typeof imageBase64 !== 'string' || !imageBase64) {
      return res.status(400).json({ error: 'Aucune image fournie.' });
    }

    const ai = getAI();
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { data: cleanBase64, mimeType } }, { text: prompt }],
        },
      ],
    });

    res.json({ text: response.text || 'Analyse terminée sans texte généré.' });
  } catch (error: any) {
    console.error('Error in /api/ai/analyze-image:', error);
    res.status(500).json({ error: "Erreur lors de l'analyse d'image", details: error.message });
  }
});

// Synthese des feedbacks : reservee aux roles qui voient tous les retours
aiRouter.post('/feedback-summary', requireCapability('canSeeAllFeedback'), async (req, res) => {
  try {
    const { sessionTitle, feedbacks } = req.body;
    const ai = getAI();

    const prompt = `Voici les retours reçus pour la session "${sessionTitle}" à IndabaX Bénin:
${JSON.stringify(feedbacks)}

Fournis une synthèse exécutive pour les organisateurs et le conférencier :
1. Note moyenne et sentiment général.
2. Points forts les plus appréciés.
3. Axes d'amélioration ou questions restées en suspens.
4. Recommandation pour les futures éditions.`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    res.json({ summary: response.text || 'Aucun résumé disponible.' });
  } catch (error: any) {
    console.error('Error in /api/ai/feedback-summary:', error);
    res.status(500).json({ error: error.message });
  }
});
