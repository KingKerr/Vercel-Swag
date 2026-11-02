BEGIN;

CREATE TABLE concierge.eve_sessions (
  eve_session_id text PRIMARY KEY
    CHECK (length(eve_session_id) BETWEEN 1 AND 512),

  shopper_session_id uuid NOT NULL
    REFERENCES concierge.sessions(id),

  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,

  CHECK (expires_at > created_at)
);

CREATE INDEX eve_sessions_shopper_idx
  ON concierge.eve_sessions (
    shopper_session_id,
    created_at DESC
  );

INSERT INTO concierge.schema_migrations (version)
VALUES ('002_eve_session_ownership');

COMMIT;