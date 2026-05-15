GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;

COMMENT ON FUNCTION public.has_role(uuid, public.app_role) IS 'Safely checks user roles inside RLS policies. Callable by anon/authenticated so policies can evaluate, but runs as security definer and only returns a boolean.';