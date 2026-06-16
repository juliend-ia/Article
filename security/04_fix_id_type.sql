-- ═══════════════════════════════════════════════════════════════════
-- MAGASIN 2K — FIX : type de id (integer au lieu de bigint)
-- ═══════════════════════════════════════════════════════════════════
-- La colonne utilisateurs.id est de type INTEGER, pas BIGINT.
-- On corrige les signatures des fonctions concernées.
-- ═══════════════════════════════════════════════════════════════════

-- Drop ancien pour éviter conflit de signatures
DROP FUNCTION IF EXISTS magasin_list_users(text);
DROP FUNCTION IF EXISTS magasin_get_user(text, bigint);
DROP FUNCTION IF EXISTS magasin_create_user(text, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS magasin_delete_user(text, bigint);
DROP FUNCTION IF EXISTS magasin_update_user(text, bigint, text, text, text, boolean, boolean, text);

-- ─── Liste users ───
CREATE OR REPLACE FUNCTION magasin_list_users(admin_hash text)
RETURNS TABLE(id integer, login text, prenom text, role text, actif boolean, peut_modifier boolean)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM utilisateurs u WHERE u.password_hash = admin_hash AND u.role = 'admin' AND u.actif = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY SELECT u.id, u.login, u.prenom, u.role, u.actif, u.peut_modifier FROM utilisateurs u ORDER BY u.prenom;
END;
$$;

-- ─── Get user ───
CREATE OR REPLACE FUNCTION magasin_get_user(admin_hash text, p_id integer)
RETURNS TABLE(id integer, login text, prenom text, role text, actif boolean, peut_modifier boolean)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM utilisateurs u WHERE u.password_hash = admin_hash AND u.role = 'admin' AND u.actif = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY SELECT u.id, u.login, u.prenom, u.role, u.actif, u.peut_modifier FROM utilisateurs u WHERE u.id = p_id;
END;
$$;

-- ─── Create user ───
CREATE OR REPLACE FUNCTION magasin_create_user(
  admin_hash text, p_login text, p_prenom text, p_hash text, p_role text, p_peut_modifier boolean
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_id integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM utilisateurs u WHERE u.password_hash = admin_hash AND u.role = 'admin' AND u.actif = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  INSERT INTO utilisateurs(login, prenom, password_hash, role, actif, peut_modifier)
  VALUES (p_login, p_prenom, p_hash, p_role, true, p_peut_modifier)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- ─── Delete user ───
CREATE OR REPLACE FUNCTION magasin_delete_user(admin_hash text, p_id integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM utilisateurs u WHERE u.password_hash = admin_hash AND u.role = 'admin' AND u.actif = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM utilisateurs WHERE id = p_id;
END;
$$;

-- ─── Update user ───
CREATE OR REPLACE FUNCTION magasin_update_user(
  admin_hash text, p_id integer, p_prenom text, p_login text, p_role text,
  p_actif boolean, p_peut_modifier boolean, p_new_hash text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM utilisateurs u WHERE u.password_hash = admin_hash AND u.role = 'admin' AND u.actif = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_new_hash IS NOT NULL AND p_new_hash != '' THEN
    UPDATE utilisateurs SET prenom = p_prenom, login = p_login, role = p_role,
                            actif = p_actif, peut_modifier = p_peut_modifier,
                            password_hash = p_new_hash
    WHERE id = p_id;
  ELSE
    UPDATE utilisateurs SET prenom = p_prenom, login = p_login, role = p_role,
                            actif = p_actif, peut_modifier = p_peut_modifier
    WHERE id = p_id;
  END IF;
END;
$$;

-- ─── Permissions ───
GRANT EXECUTE ON FUNCTION magasin_list_users(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_get_user(text,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_create_user(text,text,text,text,text,boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_delete_user(text,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_update_user(text,integer,text,text,text,boolean,boolean,text) TO anon, authenticated;

-- ✅ Types corrigés
