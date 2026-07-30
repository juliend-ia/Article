-- ═══════════════════════════════════════════════════════════════════
-- MAGASIN 2K — Verrouillage des tables sensibles
-- ═══════════════════════════════════════════════════════════════════
-- Ferme l'accès direct (clé publique) à :
--   demandes_compte   (fuite matricule + hash de mot de passe)
--   demandes_reset    (fuite logins)
--   historique_actions(fuite qui-a-fait-quoi)
-- Tout passe désormais par des fonctions SECURITY DEFINER contrôlées.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Pré-login (aucun compte requis) : déposer une demande ───

-- Demande de compte (inscription) — insère si pas déjà en attente
CREATE OR REPLACE FUNCTION magasin_demande_compte(p_matricule text, p_prenom text, p_hash text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $dc$
BEGIN
  IF EXISTS (SELECT 1 FROM demandes_compte WHERE matricule = p_matricule AND statut = 'en_attente') THEN
    RETURN 'exists';
  END IF;
  INSERT INTO demandes_compte (matricule, prenom, password_hash, statut)
  VALUES (p_matricule, p_prenom, p_hash, 'en_attente');
  RETURN 'ok';
END;
$dc$;

-- Demande de réinitialisation de mot de passe — insère si pas déjà en attente
CREATE OR REPLACE FUNCTION magasin_demande_reset(p_login text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $dr$
BEGIN
  IF EXISTS (SELECT 1 FROM demandes_reset WHERE login = p_login AND traitee = false) THEN
    RETURN 'exists';
  END IF;
  INSERT INTO demandes_reset (login, traitee) VALUES (p_login, false);
  RETURN 'ok';
END;
$dr$;

-- ─── Journalisation (tout utilisateur actif) ───
CREATE OR REPLACE FUNCTION magasin_log_action(user_hash text, p_action text, p_details text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $lg$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM magasin_auth(user_hash);
  IF NOT FOUND THEN RETURN; END IF;  -- pas de log si non authentifié (silencieux)
  INSERT INTO historique_actions (login, prenom, action, details)
  SELECT a.u_login, COALESCE((SELECT u.prenom FROM utilisateurs u WHERE u.login = a.u_login), a.u_login),
         p_action, COALESCE(p_details, '');
END;
$lg$;

-- Comptage des prêts d'outillage (tout utilisateur actif) — renvoie juste les libellés
CREATE OR REPLACE FUNCTION magasin_pret_counts(user_hash text)
RETURNS TABLE(action text) LANGUAGE plpgsql SECURITY DEFINER STABLE AS $pc$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM magasin_auth(user_hash);
  IF NOT FOUND THEN RETURN; END IF;
  RETURN QUERY SELECT h.action FROM historique_actions h WHERE h.action LIKE 'Pret outillage%';
END;
$pc$;

-- ─── Lectures & actions réservées à l'admin ───

CREATE OR REPLACE FUNCTION magasin_list_demandes_compte(admin_hash text)
RETURNS TABLE(id uuid, matricule text, prenom text, statut text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $ldc$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM magasin_auth(admin_hash);
  IF NOT FOUND OR a.u_role <> 'admin' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY SELECT d.id, d.matricule, d.prenom, d.statut, d.created_at
               FROM demandes_compte d WHERE d.statut = 'en_attente' ORDER BY d.created_at ASC;
END;
$ldc$;

-- Accepter une demande : crée le compte (hash lu côté serveur) + marque valide
CREATE OR REPLACE FUNCTION magasin_accept_demande(admin_hash text, p_id uuid, p_role text, p_peut_modifier boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $ad$
DECLARE a record; d record;
BEGIN
  SELECT * INTO a FROM magasin_auth(admin_hash);
  IF NOT FOUND OR a.u_role <> 'admin' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT * INTO d FROM demandes_compte WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF EXISTS (SELECT 1 FROM utilisateurs u WHERE u.login = d.matricule) THEN
    RAISE EXCEPTION 'Login déjà existant';
  END IF;
  INSERT INTO utilisateurs (login, prenom, password_hash, role, actif, peut_modifier)
  VALUES (d.matricule, d.prenom, d.password_hash, p_role, true, COALESCE(p_peut_modifier, true));
  UPDATE demandes_compte SET statut = 'valide' WHERE id = p_id;
  RETURN d.matricule;
END;
$ad$;

CREATE OR REPLACE FUNCTION magasin_refuse_demande(admin_hash text, p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $rd$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM magasin_auth(admin_hash);
  IF NOT FOUND OR a.u_role <> 'admin' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE demandes_compte SET statut = 'refuse' WHERE id = p_id;
END;
$rd$;

CREATE OR REPLACE FUNCTION magasin_list_demandes_reset(admin_hash text)
RETURNS TABLE(id uuid, login text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $ldr$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM magasin_auth(admin_hash);
  IF NOT FOUND OR a.u_role <> 'admin' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY SELECT r.id, r.login, r.created_at
               FROM demandes_reset r WHERE r.traitee = false ORDER BY r.created_at ASC;
END;
$ldr$;

CREATE OR REPLACE FUNCTION magasin_treat_demande_reset(admin_hash text, p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $tdr$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM magasin_auth(admin_hash);
  IF NOT FOUND OR a.u_role <> 'admin' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE demandes_reset SET traitee = true WHERE id = p_id;
END;
$tdr$;

CREATE OR REPLACE FUNCTION magasin_list_actions(admin_hash text, p_limit int)
RETURNS TABLE(login text, prenom text, action text, details text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $la$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM magasin_auth(admin_hash);
  IF NOT FOUND OR a.u_role <> 'admin' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY SELECT h.login, h.prenom, h.action, h.details, h.created_at
               FROM historique_actions h ORDER BY h.created_at DESC LIMIT COALESCE(p_limit, 50);
END;
$la$;

-- ─── Permissions d'exécution ───
GRANT EXECUTE ON FUNCTION magasin_demande_compte(text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_demande_reset(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_log_action(text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_pret_counts(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_list_demandes_compte(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_accept_demande(text,uuid,text,boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_refuse_demande(text,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_list_demandes_reset(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_treat_demande_reset(text,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_list_actions(text,int) TO anon, authenticated;

-- ─── LE VERROU : plus aucun accès direct à ces 3 tables ───
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE demandes_compte    FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE demandes_reset     FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE historique_actions FROM anon, authenticated;

-- ✅ Terminé. L'app v82+ passe uniquement par les fonctions ci-dessus.
