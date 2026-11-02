BEGIN;

CREATE TABLE concierge.usage_buckets (
  action text NOT NULL,
  subject text NOT NULL,
  bucket_start timestamptz NOT NULL,
  used integer NOT NULL CHECK (used > 0),

  PRIMARY KEY (action, subject, bucket_start)
);

CREATE FUNCTION concierge.reserve_usage(
  p_action text,
  p_shopper_id uuid,
  p_shopper_limit integer,
  p_global_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_bucket timestamptz;
  v_subject text;
  v_limit integer;
  v_used integer;
  v_index integer;
BEGIN
  IF p_action IS NULL
     OR p_shopper_id IS NULL
     OR p_shopper_limit <= 0
     OR p_global_limit <= 0
     OR p_window_seconds <= 0
  THEN
    RAISE EXCEPTION 'Invalid usage policy';
  END IF;

  v_bucket := date_bin(
    make_interval(secs => p_window_seconds),
    clock_timestamp(),
    timestamptz '2000-01-01 00:00:00+00'
  );

  -- This block is a subtransaction. If either allowance is
  -- exhausted, both counter changes in the block are rolled back.
  BEGIN
    -- Always acquire the global counter first.
    FOR v_index IN 1..2 LOOP
      v_subject := CASE
        WHEN v_index = 1 THEN 'global'
        ELSE p_shopper_id::text
      END;

      v_limit := CASE
        WHEN v_index = 1 THEN p_global_limit
        ELSE p_shopper_limit
      END;

      INSERT INTO concierge.usage_buckets (
        action,
        subject,
        bucket_start,
        used
      )
      VALUES (
        p_action,
        v_subject,
        v_bucket,
        1
      )
      ON CONFLICT (action, subject, bucket_start)
      DO UPDATE
        SET used = concierge.usage_buckets.used + 1
        WHERE concierge.usage_buckets.used < v_limit
      RETURNING used INTO v_used;

      IF NOT FOUND THEN
        RAISE EXCEPTION USING
          ERRCODE = 'P0001',
          MESSAGE = 'concierge_usage_exhausted';
      END IF;
    END LOOP;

    RETURN true;

  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      RETURN false;
  END;
END;
$$;

INSERT INTO concierge.schema_migrations (version)
VALUES ('003_concierge_usage');

COMMIT;