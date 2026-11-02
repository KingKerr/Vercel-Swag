BEGIN;

CREATE SCHEMA concierge;

CREATE TABLE concierge.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE concierge.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Store a SHA-256 hash of the browser's random session secret.
  -- Never store that raw cookie secret here.
  token_hash text NOT NULL UNIQUE
    CHECK (token_hash ~ '^[0-9a-f]{64}$'),

  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,

  CHECK (expires_at > created_at)
);

CREATE TABLE concierge.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  session_id uuid NOT NULL
    REFERENCES concierge.sessions(id),

  schema_version integer NOT NULL DEFAULT 1
    CHECK (schema_version = 1),

  currency text NOT NULL DEFAULT 'USD'
    CHECK (currency = 'USD'),

  budget_cents bigint NOT NULL
    CHECK (budget_cents BETWEEN 0 AND 100000000),

  subtotal_cents bigint NOT NULL
    CHECK (
      subtotal_cents >= 0
      AND subtotal_cents <= budget_cents
    ),

  -- Canonical, server-validated product/quantity/price snapshot.
  items jsonb NOT NULL
    CHECK (
      jsonb_typeof(items) = 'array'
      AND jsonb_array_length(items) BETWEEN 1 AND 8
    ),

  -- HMAC fingerprint of the existing cart token, not the token itself.
  -- NULL means there was no cart when the proposal was prepared.
  cart_fingerprint text
    CHECK (
      cart_fingerprint IS NULL
      OR cart_fingerprint ~ '^[0-9a-f]{64}$'
    ),

  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,

  UNIQUE (id, session_id),

  CHECK (expires_at > created_at)
);

CREATE INDEX proposals_session_created_idx
  ON concierge.proposals (session_id, created_at DESC);

-- A reviewed proposal is never edited in place.
-- A changed kit must get a new proposal ID.
CREATE FUNCTION concierge.reject_proposal_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Concierge proposals are immutable; create a new proposal';
END;
$$;

CREATE TRIGGER proposals_immutable
BEFORE UPDATE ON concierge.proposals
FOR EACH ROW
EXECUTE FUNCTION concierge.reject_proposal_update();

CREATE TABLE concierge.operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  proposal_id uuid NOT NULL UNIQUE,
  session_id uuid NOT NULL,

  status text NOT NULL DEFAULT 'claimed'
    CHECK (
      status IN (
        'claimed',
        'running',
        'succeeded',
        'failed',
        'needs_review'
      )
    ),

  approved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,

  -- Application-controlled code, not a raw exception or API response.
  outcome_code text
    CHECK (
      outcome_code IS NULL
      OR outcome_code ~ '^[a-z0-9_]{1,80}$'
    ),

  FOREIGN KEY (proposal_id, session_id)
    REFERENCES concierge.proposals (id, session_id),

  CHECK (
    (
      status IN ('succeeded', 'failed')
      AND finished_at IS NOT NULL
    )
    OR
    (
      status IN ('claimed', 'running', 'needs_review')
      AND finished_at IS NULL
    )
  )
);

-- Prevent competing concierge operations for one shopper session.
-- Uncertain/partial operations stay blocked pending reconciliation.
CREATE UNIQUE INDEX operations_one_open_per_session_idx
  ON concierge.operations (session_id)
  WHERE status IN ('claimed', 'running', 'needs_review');

CREATE TABLE concierge.operation_items (
  operation_id uuid NOT NULL
    REFERENCES concierge.operations(id),

  line_number integer NOT NULL
    CHECK (line_number BETWEEN 1 AND 8),

  product_id text NOT NULL
    CHECK (length(product_id) BETWEEN 1 AND 200),

  quantity integer NOT NULL
    CHECK (quantity BETWEEN 1 AND 100),

  unit_price_cents bigint NOT NULL
    CHECK (unit_price_cents BETWEEN 0 AND 100000000),

  status text NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'attempting',
        'succeeded',
        'failed',
        'uncertain',
        'skipped'
      )
    ),

  -- Existing quantity immediately before an attempted addition.
  baseline_quantity integer
    CHECK (baseline_quantity >= 0),

  -- Quantity observed in a confirmed upstream response/readback.
  confirmed_quantity integer
    CHECK (confirmed_quantity >= 0),

  attempt_started_at timestamptz,
  finished_at timestamptz,

  outcome_code text
    CHECK (
      outcome_code IS NULL
      OR outcome_code ~ '^[a-z0-9_]{1,80}$'
    ),

  PRIMARY KEY (operation_id, line_number),
  UNIQUE (operation_id, product_id)
);

INSERT INTO concierge.schema_migrations (version)
VALUES ('001_concierge');

COMMIT;