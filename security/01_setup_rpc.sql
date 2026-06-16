-- ═══════════════════════════════════════════════════════════════════
-- MAGASIN 2K — ÉTAPE A : Création des fonctions sécurisées (RPC)
-- ═══════════════════════════════════════════════════════════════════
-- À EXÉCUTER EN PREMIER dans Supabase SQL Editor
-- → Ne casse RIEN dans l'app actuelle (les fonctions s'ajoutent en plus)
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Auth : login utilisateur ───
CREATE OR REPLACE FUNCTION magasin_login(p_login text, p_hash text)
RETURNS TABLE(login text, prenom text, role text, actif boolean, peut_modifier boolean)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT u.login, u.prenom, u.role, u.actif, u.peut_modifier
  FROM utilisateurs u
  WHERE u.login = p_login AND u.password_hash = p_hash;
$$;

-- ─── 2. Auth : reprise de session (par hash en localStorage) ───
CREATE OR REPLACE FUNCTION magasin_session_check(p_hash text)
RETURNS TABLE(login text, prenom text, role text, actif boolean, peut_modifier boolean)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT u.login, u.prenom, u.role, u.actif, u.peut_modifier
  FROM utilisateurs u
  WHERE u.password_hash = p_hash;
$$;

-- ─── 3. Vérifier un hash admin (sortie kiosque) ───
CREATE OR REPLACE FUNCTION magasin_check_admin(p_hash text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM utilisateurs WHERE password_hash = p_hash AND role = 'admin' AND actif = true);
$$;

-- ─── 4. Vérifier qu'un login existe (pour mot de passe oublié + création compte) ───
CREATE OR REPLACE FUNCTION magasin_check_login_exists(p_login text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM utilisateurs WHERE login = p_login AND actif = true);
$$;

-- ─── 5. Liste utilisateurs (admin uniquement) ───
CREATE OR REPLACE FUNCTION magasin_list_users(admin_hash text)
RETURNS TABLE(id bigint, login text, prenom text, role text, actif boolean, peut_modifier boolean)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM utilisateurs WHERE password_hash = admin_hash AND role = 'admin' AND actif = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY SELECT u.id, u.login, u.prenom, u.role, u.actif, u.peut_modifier FROM utilisateurs u ORDER BY u.prenom;
END;
$$;

-- ─── 6. Récupérer un utilisateur (admin uniquement) ───
CREATE OR REPLACE FUNCTION magasin_get_user(admin_hash text, p_id bigint)
RETURNS TABLE(id bigint, login text, prenom text, role text, actif boolean, peut_modifier boolean)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM utilisateurs WHERE password_hash = admin_hash AND role = 'admin' AND actif = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY SELECT u.id, u.login, u.prenom, u.role, u.actif, u.peut_modifier FROM utilisateurs u WHERE u.id = p_id;
END;
$$;

-- ─── 7. Créer un utilisateur (admin uniquement) ───
CREATE OR REPLACE FUNCTION magasin_create_user(
  admin_hash text, p_login text, p_prenom text, p_hash text, p_role text, p_peut_modifier boolean
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_id bigint;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM utilisateurs WHERE password_hash = admin_hash AND role = 'admin' AND actif = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  INSERT INTO utilisateurs(login, prenom, password_hash, role, actif, peut_modifier)
  VALUES (p_login, p_prenom, p_hash, p_role, true, p_peut_modifier)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- ─── 8. Supprimer un utilisateur (admin uniquement) ───
CREATE OR REPLACE FUNCTION magasin_delete_user(admin_hash text, p_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM utilisateurs WHERE password_hash = admin_hash AND role = 'admin' AND actif = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM utilisateurs WHERE id = p_id;
END;
$$;

-- ─── 9. Modifier un utilisateur (admin uniquement) ───
CREATE OR REPLACE FUNCTION magasin_update_user(
  admin_hash text, p_id bigint, p_prenom text, p_login text, p_role text,
  p_actif boolean, p_peut_modifier boolean, p_new_hash text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM utilisateurs WHERE password_hash = admin_hash AND role = 'admin' AND actif = true) THEN
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

-- ─── 10. Réinitialiser mot de passe (admin uniquement) ───
CREATE OR REPLACE FUNCTION magasin_reset_password(admin_hash text, p_login text, p_new_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM utilisateurs WHERE password_hash = admin_hash AND role = 'admin' AND actif = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE utilisateurs SET password_hash = p_new_hash WHERE login = p_login;
END;
$$;

-- ─── PERMISSIONS : autoriser anon et authenticated à appeler ces fonctions ───
GRANT EXECUTE ON FUNCTION magasin_login(text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_session_check(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_check_admin(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_check_login_exists(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_list_users(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_get_user(text,bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_create_user(text,text,text,text,text,boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_delete_user(text,bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_update_user(text,bigint,text,text,text,boolean,boolean,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_reset_password(text,text,text) TO anon, authenticated;

-- ✅ FIN ÉTAPE A
-- Test rapide : tu peux exécuter
--   SELECT * FROM magasin_login('Djulien', 'TON_HASH');
-- Si ça renvoie une ligne avec ton compte, c'est bon.
