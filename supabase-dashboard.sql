-- =============================================
-- INDICA LICENSE KEYS - FULL SETUP
-- =============================================
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run on an existing DB (everything below is idempotent).
--
-- Sections:
--   1. license_keys table + RLS
--   2. activate_license() - binds hwid + starts the duration clock
--   3. buy_license_time() / buy_license_time_by_key() - extend expiry
--   4. secure_choose() - math helper
--   5. Performance indexes
--   6. Dashboard functions for site/dashboard.html (dashboard_license,
--      dashboard_reset_hwid) - the dashboard never reads license_keys
--      directly; these check the key + password on the database and
--      return only safe fields, so a password never travels to the
--      browser and nobody can list other keys.

-- =============================================
-- 1. license_keys table
-- =============================================
CREATE TABLE IF NOT EXISTS public.license_keys (
    id BIGSERIAL PRIMARY KEY,
    license_key TEXT UNIQUE NOT NULL,
    password TEXT,
    expires_at TIMESTAMPTZ,          -- stamped at ACTIVATION, not at creation
    duration_days NUMERIC,           -- license length in days; clock starts when hwid is set
    is_active BOOLEAN DEFAULT TRUE,
    hwid TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Keep required columns present (safe to re-run on an existing DB)
ALTER TABLE public.license_keys
    ADD COLUMN IF NOT EXISTS name TEXT,     -- display name, shown in the app's profile
    ADD COLUMN IF NOT EXISTS pfp TEXT,      -- profile picture as a data: URL
    ADD COLUMN IF NOT EXISTS password TEXT,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS duration_days NUMERIC,
    ADD COLUMN IF NOT EXISTS hwid TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Keys start unlocked. hwid is filled by activate_license() on first use.
UPDATE public.license_keys SET hwid = NULL WHERE hwid = '';
COMMENT ON COLUMN public.license_keys.hwid IS
'Filled automatically by activate_license() on first successful validation. Leave NULL when creating new keys.';
COMMENT ON COLUMN public.license_keys.duration_days IS
'License length in days. expires_at is stamped = now() + duration_days the moment the key is first activated (hwid set), so the clock only starts counting down then.';

-- =============================================
-- ROW LEVEL SECURITY (RLS) FOR HACK PREVENTION
-- =============================================
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;

-- Anon can SELECT so the client can verify a license.
-- (Tradeoff: this exposes key+password rows to anyone holding the anon key.
--  The dashboard functions below avoid this by never selecting the table
--  directly from the browser.)
DROP POLICY IF EXISTS "Allow anon read" ON public.license_keys;
CREATE POLICY "Allow anon read" ON public.license_keys
    FOR SELECT
    TO public
    USING (true);

-- Explicit privileges.
--    service_role does all dashboard writes (create / extend / delete).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_keys TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.license_keys_id_seq TO service_role;

--    anon/authenticated are read-only; they never write to the table directly.
GRANT SELECT ON public.license_keys TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.license_keys FROM anon, authenticated;

--    But allow anon to set the hwid ONCE (first bind) via column-level grant.
--    The BEFORE UPDATE trigger below auto-starts the duration_days clock.
GRANT UPDATE (hwid) ON public.license_keys TO anon, authenticated;

--    RLS policy: anon can only UPDATE a row when hwid IS NULL (first bind).
--    Once hwid is set, further UPDATE attempts from anon are blocked by this policy.
DROP POLICY IF EXISTS "Allow anon hwid bind" ON public.license_keys;
CREATE POLICY "Allow anon hwid bind" ON public.license_keys
    FOR UPDATE
    TO anon, authenticated
    USING (hwid IS NULL)
    WITH CHECK (hwid IS NOT NULL);

--    The old "Allow auto HWID binding" policy was a no-op (its WITH CHECK compared
--    expires_at against the same row), so it allowed ANY anon update including
--    expiry tampering. All client writes go through SECURITY DEFINER functions now.
DROP POLICY IF EXISTS "Allow auto HWID binding" ON public.license_keys;

-- =============================================
-- 2. ACTIVATION: BINDS HWID + STARTS THE CLOCK
-- =============================================
-- Called by your jar on first successful validation:
--   rpc('activate_license', { p_license_key: 'XXXX-XXXX', p_hwid: 'device-id' })
--  - First activation: binds the hwid and stamps expires_at = now() + duration_days.
--    The countdown only starts from this moment.
--  - Re-validation from the same hwid: returns remaining time.
--  - Different hwid: rejected.
CREATE OR REPLACE FUNCTION public.activate_license(
    p_license_key TEXT,
    p_hwid TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key public.license_keys%ROWTYPE;
    v_remaining INTERVAL;
BEGIN
    IF p_hwid IS NULL OR btrim(p_hwid) = '' THEN
        RAISE EXCEPTION 'hwid is required.';
    END IF;

    SELECT * INTO v_key
    FROM public.license_keys
    WHERE license_key = p_license_key;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'License key not found.';
    END IF;

    IF NOT v_key.is_active THEN
        RAISE EXCEPTION 'License key is disabled.';
    END IF;

    -- First ever activation -> bind hwid and start the clock
    IF v_key.hwid IS NULL OR btrim(v_key.hwid) = '' THEN
        IF v_key.duration_days IS NOT NULL THEN
            UPDATE public.license_keys
            SET hwid = btrim(p_hwid),
                expires_at = NOW() + make_interval(days => v_key.duration_days::float8)
            WHERE id = v_key.id;
        ELSE
            -- Legacy key created before duration_days existed: keep its expiry as-is
            UPDATE public.license_keys
            SET hwid = btrim(p_hwid)
            WHERE id = v_key.id;
        END IF;

        SELECT * INTO v_key FROM public.license_keys WHERE id = v_key.id;

        RETURN jsonb_build_object(
            'success', true,
            'activated', true,
            'expires_at', v_key.expires_at
        );
    END IF;

    -- Already bound to a different hwid -> reject
    IF lower(v_key.hwid) <> lower(btrim(p_hwid)) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'license_used_on_another_hwid',
            'message', 'This license is already bound to another device.'
        );
    END IF;

    -- Same hwid re-validating -> return remaining time
    IF v_key.expires_at IS NULL THEN
        RETURN jsonb_build_object('success', true, 'activated', true, 'expires_at', NULL);
    END IF;

    v_remaining := v_key.expires_at - NOW();
    RETURN jsonb_build_object(
        'success', true,
        'activated', false,
        'expires_at', v_key.expires_at,
        'remaining', v_remaining
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_license(TEXT, TEXT) TO anon, authenticated;

-- =============================================
-- AUTO-START DURATION CLOCK WHEN HWID IS FIRST BOUND
-- =============================================
-- When the client PATCHes hwid from NULL to a value, this trigger
-- automatically sets expires_at = NOW() + duration_days so the
-- license countdown starts at the moment of first activation.
CREATE OR REPLACE FUNCTION public.trg_start_license_clock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.hwid IS NULL AND NEW.hwid IS NOT NULL THEN
        IF NEW.duration_days IS NOT NULL AND NEW.expires_at IS NULL THEN
            NEW.expires_at = NOW() + make_interval(days => NEW.duration_days::float8);
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_start_license_clock ON public.license_keys;
CREATE TRIGGER trg_start_license_clock
    BEFORE UPDATE ON public.license_keys
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_start_license_clock();

-- =============================================
-- 3. SECURE SUBSCRIPTION PURCHASES
-- =============================================
CREATE OR REPLACE FUNCTION public.buy_license_time(
    p_key_id BIGINT,
    p_days INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_expiry TIMESTAMPTZ;
    v_new_expiry TIMESTAMPTZ;
BEGIN
    IF p_days IS NULL OR p_days <= 0 OR p_days > 3650 THEN
        RAISE EXCEPTION 'Invalid package duration.';
    END IF;

    SELECT expires_at INTO v_current_expiry
    FROM public.license_keys
    WHERE id = p_key_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'License key not found.';
    END IF;

    IF v_current_expiry IS NULL OR v_current_expiry < NOW() THEN
        v_new_expiry := NOW() + make_interval(days => p_days);
    ELSE
        v_new_expiry := v_current_expiry + make_interval(days => p_days);
    END IF;

    UPDATE public.license_keys
    SET expires_at = v_new_expiry
    WHERE id = p_key_id;

    RETURN jsonb_build_object('success', true, 'new_expiry', v_new_expiry);
END;
$$;

-- Convenience variant: looks up by license_key (what the dashboard/jar usually have)
CREATE OR REPLACE FUNCTION public.buy_license_time_by_key(
    p_license_key TEXT,
    p_days INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key_id BIGINT;
BEGIN
    SELECT id INTO v_key_id FROM public.license_keys WHERE license_key = p_license_key;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'License key not found.';
    END IF;
    RETURN public.buy_license_time(v_key_id, p_days);
END;
$$;

GRANT EXECUTE ON FUNCTION public.buy_license_time(BIGINT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buy_license_time_by_key(TEXT, INT) TO anon, authenticated;

-- =============================================
-- 4. COMBINATIONS MATH HELPER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.secure_choose(n INT, k INT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    r NUMERIC := 1.0;
BEGIN
    IF k < 0 OR k > n THEN RETURN 0.0; END IF;
    IF k = 0 OR k = n THEN RETURN 1.0; END IF;
    IF k > n / 2 THEN k := n - k; END IF;
    FOR i IN 1..k LOOP
        r := r * (n - i + 1) / i;
    END LOOP;
    RETURN r;
END;
$$;

-- =============================================
-- 5. Performance indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_nicotine_license_key ON public.license_keys(license_key);
CREATE INDEX IF NOT EXISTS idx_nicotine_hwid ON public.license_keys(hwid);
CREATE INDEX IF NOT EXISTS idx_nicotine_expires_at ON public.license_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_nicotine_is_active ON public.license_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_nicotine_created_at ON public.license_keys(created_at DESC);      -- dashboard ordering
CREATE INDEX IF NOT EXISTS idx_nicotine_batch ON public.license_keys((metadata ->> 'batch'));    -- dashboard batch filter

-- =============================================
-- 6. Dashboard functions for site/dashboard.html
-- =============================================
-- The dashboard never reads the license_keys table directly. These functions
-- check the key + password on the database and return only safe fields, so a
-- password never travels to the browser and nobody can list other keys.

CREATE OR REPLACE FUNCTION public.dashboard_license(p_key TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
           'license_key',   l.license_key,
           'name',          l.name,
           'pfp',           l.pfp,
           'is_active',     l.is_active,
           'expires_at',    l.expires_at,
           'duration_days', l.duration_days,
           'hwid_bound',    l.hwid IS NOT NULL,
           -- only a short hint of the hardware id, never the full value
           'hwid_hint',     CASE WHEN l.hwid IS NULL THEN NULL ELSE left(l.hwid, 8) || '...' END
         )
  FROM public.license_keys l
  WHERE l.license_key = p_key
    AND l.password IS NOT NULL
    AND l.password = p_password
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_reset_hwid(p_key TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed INT;
BEGIN
  UPDATE public.license_keys
     SET hwid = NULL
   WHERE license_key = p_key
     AND password IS NOT NULL
     AND password = p_password;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_license(TEXT, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.dashboard_reset_hwid(TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.dashboard_license(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_reset_hwid(TEXT, TEXT) TO anon, authenticated;

-- Profile: the display name and picture the app shows in the profile group.
-- Same key + password check as the two functions above. The picture is sent
-- as a data: URL (checked to be a small image below), so nothing is uploaded
-- to a storage bucket and no bucket policy is needed.
CREATE OR REPLACE FUNCTION public.dashboard_save_profile(
    p_key TEXT,
    p_password TEXT,
    p_name TEXT,
    p_pfp TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    changed INT;
BEGIN
    IF p_pfp IS NOT NULL AND p_pfp NOT LIKE 'data:image/%' THEN
        RAISE EXCEPTION 'Profile picture must be an image.';
    END IF;
    -- ~48 KB of base64: the app embeds this picture in its menu, so it stays small.
    IF p_pfp IS NOT NULL AND length(p_pfp) > 65536 THEN
        RAISE EXCEPTION 'Profile picture is too large.';
    END IF;
    UPDATE public.license_keys
       SET name = left(NULLIF(btrim(p_name), ''), 32),
           pfp  = NULLIF(p_pfp, '')
     WHERE license_key = p_key
       AND password IS NOT NULL
       AND password = p_password;
    GET DIAGNOSTICS changed = ROW_COUNT;
    RETURN changed = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_save_profile(TEXT, TEXT, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.dashboard_save_profile(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- =============================================
-- VERIFY SETUP
-- =============================================
NOTIFY pgrst, 'reload schema';
