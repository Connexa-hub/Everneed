-- CX-09 / R24-R25: owner-controlled temporary store pause + normalized name uniqueness.
-- One owner remains one store (stores_owner_id_key is intentionally retained).
-- Store name normalization: trim and collapse whitespace, case-insensitive uniqueness.
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS paused_until timestamptz;

CREATE OR REPLACE FUNCTION private.normalize_store_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  NEW.name := btrim(regexp_replace(NEW.name, '[[:space:]]+', ' ', 'g'));
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS stores_normalize_name_before_write ON public.stores;
CREATE TRIGGER stores_normalize_name_before_write
BEFORE INSERT OR UPDATE OF name ON public.stores
FOR EACH ROW EXECUTE FUNCTION private.normalize_store_name();

-- Existing staging names were audited for normalized collisions (none found).
CREATE UNIQUE INDEX IF NOT EXISTS stores_normalized_name_unique
ON public.stores (lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')));

CREATE INDEX IF NOT EXISTS stores_paused_until_idx
ON public.stores (paused_until)
WHERE paused_until IS NOT NULL;

-- Sellers cannot bypass the pause RPC by writing the pause field directly.
CREATE OR REPLACE FUNCTION private.stores_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  base text;
  n int := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    base := private.slugify(coalesce(NEW.slug, NEW.name));
    NEW.slug := base;
    WHILE EXISTS (SELECT 1 FROM public.stores WHERE slug = NEW.slug) LOOP
      n := n + 1;
      NEW.slug := base || '-' || n;
    END LOOP;
    IF NOT private.is_privileged() THEN
      IF NEW.status NOT IN ('draft', 'pending') THEN
        RAISE EXCEPTION 'A new store starts as draft or pending.';
      END IF;
      NEW.is_official := false;
      NEW.is_demo := false;
      NEW.approved_at := null;
      NEW.paused_until := null;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT private.is_privileged() THEN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.is_official IS DISTINCT FROM OLD.is_official
       OR NEW.is_demo IS DISTINCT FROM OLD.is_demo
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.slug IS DISTINCT FROM OLD.slug
       OR NEW.paused_until IS DISTINCT FROM OLD.paused_until THEN
      RAISE EXCEPTION 'That store field cannot be changed from the app.';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (OLD.status IN ('draft', 'rejected') AND NEW.status = 'pending') THEN
      RAISE EXCEPTION 'Store status is changed by the EverNeed team.';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.seller_set_pause(p_paused_until timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_store_id text;
  v_timezone text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in.';
  END IF;

  v_store_id := private.my_store();
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'No seller store is associated with this account.';
  END IF;

  IF p_paused_until IS NOT NULL
     AND (p_paused_until <= now() OR p_paused_until > now() + interval '90 days') THEN
    RAISE EXCEPTION 'Pause expiry must be in the future and no more than 90 days away.';
  END IF;

  UPDATE public.stores
  SET paused_until = p_paused_until
  WHERE id = v_store_id AND owner_id = auth.uid() AND NOT is_official
  RETURNING business_timezone INTO v_timezone;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Store pause permission denied.';
  END IF;

  RETURN jsonb_build_object(
    'store_id', v_store_id,
    'paused_until', p_paused_until,
    'business_timezone', v_timezone,
    'is_paused', p_paused_until IS NOT NULL AND p_paused_until > now()
  );
END
$$;

REVOKE ALL ON FUNCTION public.seller_set_pause(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_set_pause(timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION private.store_live(p_store text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = p_store
      AND s.status = 'approved'
      AND (s.paused_until IS NULL OR s.paused_until <= now())
      AND (
        s.is_official
        OR EXISTS (
          SELECT 1
          FROM public.store_subscriptions ss
          JOIN public.seller_plan_entitlements e ON e.plan_id = ss.plan_id
          WHERE ss.store_id = s.id
            AND s.activation_status = 'live'
            AND private.store_verification_complete(s.id)
            AND ((ss.status IN ('trialing','active') AND ss.current_period_end > now())
              OR (ss.status = 'past_due' AND ss.grace_until > now()))
        )
      )
  )
$$;

COMMENT ON COLUMN public.stores.paused_until IS
  'Owner-controlled storefront pause expiry. Stored as timestamptz; business_timezone is used for display/input. NULL means unpaused.';
COMMENT ON FUNCTION public.seller_set_pause(timestamptz) IS
  'Owner-only temporary store pause/resume. NULL resumes; expiry must be within 90 days. Blocks new storefront visibility and checkout via private.store_live; does not mutate existing orders/payments/inventory.';
