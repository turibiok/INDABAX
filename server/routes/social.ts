import { Router } from 'express';

import { AuthedRequest, requireAuth, requireCapability } from '../sessions';
import { SheetError } from '../sheetsGateway';
import {
  Author,
  countByThread,
  findMessage,
  listAnnouncements,
  listMessages,
  postAnnouncement,
  postMessage,
  retire,
  setPinned,
  toggleLike,
} from '../social';
import { capabilitiesFor } from '../../src/permissions';

/**
 * Annonces, discussions et commentaires.
 *
 * L'auteur d'une publication n'est jamais celui que le client annonce : il est
 * pris dans la session. Sans cela, n'importe qui pourrait publier sous le nom
 * d'un organisateur, ce qui est exactement le message qu'on croirait le plus.
 */

export const socialRouter = Router();

/** Longueurs maximales, pour qu'une publication ne remplisse pas le classeur. */
const MAX_TITLE = 160;
const MAX_CONTENT = 4000;

function authorOf(req: AuthedRequest): Author {
  const session = req.session!;
  return { email: session.email, name: session.name, role: session.role };
}

function textOf(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function fail(res: any, error: any) {
  const status = error instanceof SheetError ? error.status : 500;
  res.status(status).json({
    error: error?.message || 'Échec de la publication.',
    reason: error instanceof SheetError ? error.reason : 'unknown',
  });
}

/* ------------------------------------------------------------------ *
 * Annonces
 * ------------------------------------------------------------------ */

/**
 * Liste des annonces, chacune accompagnée de ses commentaires.
 *
 * Les deux listes viennent du même classeur, mais de deux onglets : les
 * commentaires sont des messages dont le fil porte l'identifiant de l'annonce.
 */
socialRouter.get('/announcements', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const [items, comments] = await Promise.all([listAnnouncements(), listMessages()]);
    const email = req.session!.email;

    const byAnnouncement = new Map<string, typeof comments>();
    for (const comment of comments) {
      if (!comment.thread.startsWith('annonce:')) continue;
      const id = comment.thread.slice('annonce:'.length);
      const list = byAnnouncement.get(id) || [];
      list.push(comment);
      byAnnouncement.set(id, list);
    }

    res.json({
      announcements: items.map(item => ({
        ...item,
        likes: item.likedBy.length,
        // Ce que le client a besoin de savoir : si c'est déjà aimé par la
        // personne connectée. La liste complète des emails ne le regarde pas.
        likedByMe: item.likedBy.includes(email),
        likedBy: undefined,
        comments: (byAnnouncement.get(item.id) || []).map(comment => ({
          id: comment.id,
          authorName: comment.authorName,
          authorEmail: comment.authorEmail,
          authorRole: comment.authorRole,
          content: comment.content,
          timestamp: comment.timestamp,
        })),
      })),
    });
  } catch (error) {
    fail(res, error);
  }
});

socialRouter.post('/announcements', requireCapability('canBroadcast'), async (req: AuthedRequest, res) => {
  const title = textOf(req.body?.title, MAX_TITLE);
  const content = textOf(req.body?.content, MAX_CONTENT);

  if (!content) {
    return res.status(400).json({ error: 'Une annonce a besoin d’un message.', reason: 'empty' });
  }

  try {
    const { announcement, warning } = await postAnnouncement(authorOf(req), {
      title: title || content.slice(0, 60),
      content,
      category: typeof req.body?.category === 'string' ? req.body.category : '',
      pinned: req.body?.pinned === true,
    });

    res.json({ announcement: { ...announcement, likes: 0, likedByMe: false, comments: [] }, warning });
  } catch (error) {
    fail(res, error);
  }
});

socialRouter.post(
  '/announcements/:id/pin',
  requireCapability('canManageContent'),
  async (req: AuthedRequest, res) => {
    try {
      const { warning } = await setPinned(req.params.id, req.body?.pinned !== false);
      res.json({ ok: true, warning });
    } catch (error) {
      fail(res, error);
    }
  },
);

socialRouter.post(
  '/announcements/:id/retire',
  requireCapability('canManageContent'),
  async (req: AuthedRequest, res) => {
    try {
      const { warning } = await retire('announcement', req.params.id);
      res.json({ ok: true, warning });
    } catch (error) {
      fail(res, error);
    }
  },
);

socialRouter.post('/announcements/:id/like', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const result = await toggleLike(req.params.id, req.session!.email);
    res.json(result);
  } catch (error) {
    fail(res, error);
  }
});

/* ------------------------------------------------------------------ *
 * Discussions et commentaires
 * ------------------------------------------------------------------ */

socialRouter.get('/messages', requireAuth, async (req: AuthedRequest, res) => {
  const thread = typeof req.query.thread === 'string' ? req.query.thread.trim() : '';

  try {
    const [items, counts] = await Promise.all([listMessages(thread || undefined), countByThread()]);
    res.json({ messages: items, counts });
  } catch (error) {
    fail(res, error);
  }
});

socialRouter.post('/messages', requireAuth, async (req: AuthedRequest, res) => {
  const thread = textOf(req.body?.thread, 120) || 'canal:general';
  const content = textOf(req.body?.content, MAX_CONTENT);

  if (!content) {
    return res.status(400).json({ error: 'Un message vide ne part pas.', reason: 'empty' });
  }

  // Un fil doit se rattacher à un salon ou à une annonce : accepter n'importe
  // quelle chaîne laisserait créer des fils invisibles depuis l'application.
  if (!/^(canal|annonce):[A-Za-z0-9_-]{1,64}$/.test(thread)) {
    return res.status(400).json({
      error: 'Fil de discussion inconnu.',
      reason: 'bad_thread',
    });
  }

  try {
    const { message, warning } = await postMessage(authorOf(req), { thread, content });
    res.json({ message, warning });
  } catch (error) {
    fail(res, error);
  }
});

/**
 * Retrait d'un message.
 *
 * Chacun peut retirer le sien ; retirer celui d'un autre demande la
 * responsabilité du contenu. Un participant ne peut donc pas effacer la
 * réponse qui le contredit.
 */
socialRouter.post('/messages/:id/retire', requireAuth, async (req: AuthedRequest, res) => {
  const session = req.session!;
  const message = findMessage(req.params.id);

  if (!message) {
    return res.status(404).json({ error: 'Message introuvable.', reason: 'not_found' });
  }

  const isAuthor = message.authorEmail === session.email;

  if (!isAuthor && !capabilitiesFor(session.role).canManageContent) {
    return res.status(403).json({
      error: 'Vous ne pouvez retirer que vos propres messages.',
      reason: 'forbidden',
    });
  }

  try {
    const { warning } = await retire('message', req.params.id);
    res.json({ ok: true, warning });
  } catch (error) {
    fail(res, error);
  }
});
