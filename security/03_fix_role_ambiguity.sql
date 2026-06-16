-- ═══════════════════════════════════════════════════════════════════
-- MAGASIN 2K — FIX : conflit de noms "role" dans les fonctions admin
-- ═══════════════════════════════════════════════════════════════════
-- Le mot "role" est à la fois une colonne de utilisateurs ET un nom de retour
-- de TABLE(...) → PostgreSQL ne sait pas lequel choisir.
-- Solution : préfixer toutes les références à la colonne par "u." (alias).
-- ═══════════════════════════════════════════════════════════════════

-- 1. Login (déjà OK avec alias 'u', mais on remet pour sécurité)
CREATE OR REPLACE FUNCTION magasin_login(p_login text, p_hash text)
RETURNS TABLE(login text, prenom text, role text, actif boolean, peut_modifier boolean)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT u.login, u.prenom, u.role, u.actif, u.peut_modifier
  FROM utilisateurs u
  WHERE u.login = p_login AND u.password_hash = p_hash;
$$;

-- 2. Session check
CREATE OR REPLACE FUNCTION magasin_session_check(p_hash text)
RETURNS TABLE(login text, prenom text, role text, actif boolean, peut_modifier boolean)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT u.login, u.prenom, u.role, u.actif, u.peut_modifier
  FROM utilisateurs u
  WHERE u.password_hash = p_hash;
$$;

-- 3. Check admin
CREATE OR REPLACE FUNCTION magasin_check_admin(p_hash text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM utilisateurs u WHERE u.password_hash = p_hash AND u.role = 'admin' AND u.actif = true);
$$;

-- 4. Check login exists
CREATE OR REPLACE FUNCTION magasin_check_login_exists(p_login text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM utilisateurs u WHERE u.login = p_login AND u.actif = true);
$$;

-- 5. List users (FIX : alias u. partout pour éviter ambiguïté "role")
CREATE OR REPLACE FUNCTION magasin_list_users(admin_hash text)
RETURNS TABLE(id bigint, login text, prenom text, role text, actif boolean, peut_modifier boolean)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM utilisateurs u WHERE u.password_hash = admin_hash AND u.role = 'admin' AND u.actif = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY SELECT u.id, u.login, u.prenom, u.role, u.actif, u.peut_modifier FROM utilisateurs u ORDER BY u.prenom;
END;
$$;

-- 6. Get user (FIX)
CREATE OR REPLACE FUNCTION magasin_get_user(admin_hash text, p_id bigint)
RETURNS TABLE(id bigint, login text, prenom text, role text, actif boolean, peut_modifier boolean)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM utilisateurs u WHERE u.password_hash = admin_hash AND u.role = 'admin' AND u.actif = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY SELECT u.id, u.login, u.prenom, u.role, u.actif, u.peut_modifier FROM utilisateurs u WHERE u.id = p_id;
END;
$$;

-- 7. Create user (FIX)
CREATE OR REPLACE FUNCTION magasin_create_user(
  admin_hash text, p_login text, p_prenom text, p_hash text, p_role text, p_peut_modifier boolean
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_id bigint;
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

-- 8. Delete user (FIX)
CREATE OR REPLACE FUNCTION magasin_delete_user(admin_hash text, p_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM utilisateurs u WHERE u.password_hash = admin_hash AND u.role = 'admin' AND u.actif = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM utilisateurs WHERE id = p_id;
END;
$$;

-- 9. Update user (FIX)
CREATE OR REPLACE FUNCTION magasin_update_user(
  admin_hash text, p_id bigint, p_prenom text, p_login text, p_role text,
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

-- 10. Reset password (FIX)
CREATE OR REPLACE FUNCTION magasin_reset_password(admin_hash text, p_login text, p_new_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM utilisateurs u WHERE u.password_hash = admin_hash AND u.role = 'admin' AND u.actif = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE utilisateurs SET password_hash = p_new_hash WHERE login = p_login;
END;
$$;

-- ✅ FIX appliqué : toutes les références ambiguës à "role" préfixées avec "u."
