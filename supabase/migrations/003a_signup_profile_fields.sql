/*
# Save date of birth and photo at sign-up

1. What changes
- The sign-up trigger now copies date of birth and photo from the sign-up details into the new customer profile, in the same step that creates the account.
- Before, those two fields were only saved after sign-in, so an account whose email still needed confirming ended up with an incomplete profile.

2. Security
- The trigger function is a database-only hook. It is no longer callable through the public API by anonymous or signed-in users.
- Trigger firing is unaffected by this change.

3. Notes
- Existing profiles are not modified.
- Date of birth must be a valid date; the app validates it before sending.
*/

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
