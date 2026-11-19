-- 030_INICIALIZAR_PAREJA_ACTUAL.SQL
-- Bootstrap de UNA pareja a partir de la instalación existente. Es seguro
-- repetirlo: no crea una segunda pareja si los dos perfiles ya están unidos.
-- Se detiene si no hay exactamente dos perfiles habilitados.

DO $$
DECLARE
  member_ids UUID[];
  existing_couple UUID;
  new_couple UUID;
BEGIN
  SELECT array_agg(id ORDER BY created_at)
    INTO member_ids
    FROM public.profiles
   WHERE COALESCE(enabled, true);

  IF COALESCE(array_length(member_ids, 1), 0) <> 2 THEN
    RAISE EXCEPTION
      'Se esperaban exactamente 2 perfiles habilitados y se encontraron %; no se creó ninguna pareja.',
      COALESCE(array_length(member_ids, 1), 0);
  END IF;

  SELECT cm.couple_id INTO existing_couple
    FROM public.couple_members cm
   WHERE cm.user_id = ANY(member_ids)
   LIMIT 1;

  IF existing_couple IS NOT NULL THEN
    IF (SELECT count(*) FROM public.couple_members WHERE couple_id = existing_couple) <> 2
       OR NOT (SELECT array_agg(user_id ORDER BY user_id) FROM public.couple_members WHERE couple_id = existing_couple)
              @> (SELECT array_agg(id ORDER BY id) FROM public.profiles WHERE id = ANY(member_ids)) THEN
      RAISE EXCEPTION 'Ya existe una membresía incompatible; revisar couple_members antes de continuar.';
    END IF;
    RAISE NOTICE 'Pareja ya inicializada: %', existing_couple;
    RETURN;
  END IF;

  INSERT INTO public.couples DEFAULT VALUES RETURNING id INTO new_couple;
  INSERT INTO public.couple_members (couple_id, user_id)
  SELECT new_couple, id FROM unnest(member_ids) AS id;
  RAISE NOTICE 'Pareja inicializada: %', new_couple;
END $$;

-- Verificación: debe devolver exactamente dos filas y el mismo couple_id.
SELECT cm.couple_id, p.id AS user_id, p.name, p.email
  FROM public.couple_members cm
  JOIN public.profiles p ON p.id = cm.user_id
 ORDER BY cm.couple_id, p.created_at;
