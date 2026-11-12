-- 016: catch-up for the live migration `signup_profile_fields` (live version 20261029134730).
--
-- That migration was applied to the live database between 002 and 004, but its slot cannot be expressed in this
-- folder's numbering (see supabase/migrations_history/README.md). Nothing else in the chain adds date of birth and
-- photo to the sign-up function, so a rebuilt database would be missing them. This file sets on_signup() to exactly
-- the definition that live already has. Applying it to live changes nothing.
--
-- The original SQL is kept verbatim in supabase/migrations_history/20261029134730_signup_profile_fields.sql.

CREATE OR REPLACE FUNCTION public.on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles(id, email, phone, name, country, dob, photo)
  values (
    new.id,
    new.email,
    new.phone,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'country',
    nullif(new.raw_user_meta_data->>'dob', '')::date,
    nullif(new.raw_user_meta_data->>'photo', '')
  );
  return new;
end
$function$;

REVOKE EXECUTE ON FUNCTION public.on_signup() FROM PUBLIC, anon, authenticated;
