/**
 * Schema de la plateforme, en dur dans le code.
 *
 * Il vivait dans un fichier `.sql` voisin, ce qui ne survit pas au
 * regroupement : la production tourne sur un unique `dist/server.cjs`, et le
 * fichier n'y serait pas. Le garder ici le rend solidaire du code qui
 * l'execute.
 */

export const SCHEMA_SQL = `-- Schema de la plateforme Tech Event.
--
-- Rejoue a chaque demarrage : chaque instruction est donc conditionnelle, et
-- l'ordre des colonnes suit celui des ajouts plutot qu'une logique de lecture.
--
-- Ce qui est ici et non dans un classeur : les comptes, les evenements, et
-- surtout les billets. Une commande payee demande ce qu'un tableur ne sait pas
-- faire — decrementer un stock sans que deux acheteurs simultanes passent tous
-- les deux.

CREATE TABLE IF NOT EXISTS platform_accounts (
  email          TEXT PRIMARY KEY,
  name           TEXT NOT NULL DEFAULT '',
  role           TEXT NOT NULL DEFAULT 'member'
                 CHECK (role IN ('admin', 'organizer', 'member')),
  password_hash  TEXT,
  suspended      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  slug            TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  edition         TEXT NOT NULL DEFAULT '',
  start_date      DATE,
  end_date        DATE,
  location        TEXT NOT NULL DEFAULT '',
  summary         TEXT NOT NULL DEFAULT '',
  owner_email     TEXT NOT NULL REFERENCES platform_accounts(email) ON DELETE RESTRICT,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published', 'archived')),
  -- Le classeur reste possible : un evenement peut tenir son annuaire dans
  -- Google Sheets tout en vendant ses billets ici.
  sheet_url       TEXT NOT NULL DEFAULT '',
  apps_script_url TEXT NOT NULL DEFAULT '',
  logo_url        TEXT NOT NULL DEFAULT '',
  poster_url      TEXT NOT NULL DEFAULT '',
  primary_color   TEXT NOT NULL DEFAULT '#047857',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un evenement publie sans dates n'a rien a montrer sur la vitrine.
  CONSTRAINT dates_coherentes CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS events_owner_idx ON events(owner_email);
CREATE INDEX IF NOT EXISTS events_status_idx ON events(status, start_date);

-- Types de billets d'un evenement : « Gratuit », « Etudiant », « Soutien »...
CREATE TABLE IF NOT EXISTS ticket_types (
  id             BIGSERIAL PRIMARY KEY,
  event_slug     TEXT NOT NULL REFERENCES events(slug) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  -- En plus petite unite (le franc CFA n'a pas de centime, mais l'euro si) :
  -- stocker un prix en flottant finit toujours par produire un centime perdu.
  price_minor    BIGINT NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  currency       TEXT NOT NULL DEFAULT 'XOF',
  -- NULL : pas de limite. Un nombre : c'est le stock total emis.
  quantity_total INTEGER CHECK (quantity_total IS NULL OR quantity_total >= 0),
  -- Tenu a jour dans la meme transaction que les billets, ce qui rend le
  -- decompte exact meme sous deux achats simultanes.
  quantity_sold  INTEGER NOT NULL DEFAULT 0 CHECK (quantity_sold >= 0),
  sales_open     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT stock_non_depasse CHECK (quantity_total IS NULL OR quantity_sold <= quantity_total)
);

CREATE INDEX IF NOT EXISTS ticket_types_event_idx ON ticket_types(event_slug);

-- Une commande : ce que quelqu'un demande, avant que les billets existent.
CREATE TABLE IF NOT EXISTS orders (
  id             UUID PRIMARY KEY,
  event_slug     TEXT NOT NULL REFERENCES events(slug) ON DELETE CASCADE,
  buyer_email    TEXT NOT NULL,
  buyer_name     TEXT NOT NULL DEFAULT '',
  buyer_phone    TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
  total_minor    BIGINT NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  currency       TEXT NOT NULL DEFAULT 'XOF',
  -- Renseignes par le prestataire de paiement, quand il y en a un.
  payment_ref    TEXT,
  payment_method TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS orders_event_idx ON orders(event_slug, status);
CREATE INDEX IF NOT EXISTS orders_buyer_idx ON orders(lower(buyer_email));

-- Un billet nominatif, rattache a une commande.
CREATE TABLE IF NOT EXISTS tickets (
  id             UUID PRIMARY KEY,
  order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_slug     TEXT NOT NULL REFERENCES events(slug) ON DELETE CASCADE,
  ticket_type_id BIGINT NOT NULL REFERENCES ticket_types(id) ON DELETE RESTRICT,
  -- Ce qui est imprime sur le billet et scanne a l'entree. Unique par
  -- evenement : deux billets ne peuvent pas porter le meme numero.
  code           TEXT NOT NULL,
  holder_name    TEXT NOT NULL DEFAULT '',
  holder_email   TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'valid'
                 CHECK (status IN ('valid', 'used', 'void')),
  used_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT code_unique_par_evenement UNIQUE (event_slug, code)
);

CREATE INDEX IF NOT EXISTS tickets_order_idx ON tickets(order_id);
CREATE INDEX IF NOT EXISTS tickets_event_idx ON tickets(event_slug, status);
`;
