-- ═══════════════════════════════════════════════════════════════════
-- MAGASIN 2K — Sécurisation des ÉCRITURES (articles / bons / outillage)
-- ═══════════════════════════════════════════════════════════════════
-- Avant : le client écrivait directement dans les tables avec la clé
-- publique → n'importe qui possédant la clé (visible dans le source)
-- pouvait supprimer des bons ou des articles via l'API REST.
--
-- Après : toutes les écritures passent par des fonctions RPC
-- SECURITY DEFINER qui vérifient le rôle de l'utilisateur (via son
-- hash de session), puis les droits d'écriture directs sont RÉVOQUÉS.
--
-- L'app (v70+) essaie d'abord la RPC et retombe sur l'écriture directe
-- si la fonction n'existe pas encore : tu peux exécuter ce script
-- avant OU après la mise à jour de l'app, rien ne casse.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 0. Colonne soft-delete sur articles (corbeille) ───
ALTER TABLE articles ADD COLUMN IF NOT EXISTS supprime boolean DEFAULT false;

-- ─── 1. Helper interne : identifie l'utilisateur par son hash ───
CREATE OR REPLACE FUNCTION magasin_auth(user_hash text)
RETURNS TABLE(u_login text, u_role text, u_peut_modifier boolean)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN QUERY
    SELECT u.login, u.role, COALESCE(u.peut_modifier, true)
    FROM utilisateurs u
    WHERE u.password_hash = user_hash AND u.actif = true
    LIMIT 1;
END;
$$;

-- ═══════════════════════ ARTICLES ═══════════════════════

-- Créer / modifier un article (p_old_num renseigné si le N° a changé)
CREATE OR REPLACE FUNCTION magasin_save_article(user_hash text, p_old_num text, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM magasin_auth(user_hash);
  IF NOT FOUND OR NOT (a.u_role = 'admin' OR (a.u_role IN ('magasinier','brigadier') AND a.u_peut_modifier)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_old_num IS NOT NULL AND p_old_num <> '' THEN
    DELETE FROM articles WHERE num = p_old_num;
  END IF;
  DELETE FROM articles WHERE num = (p_data->>'num');
  INSERT INTO articles (num, nom, categorie, tags, location, min, max, photo, npf,
                        fournisseur, bus_std, bus_art, chimique, reparable, entretien,
                        interne, stock_securite)
  SELECT r.num, r.nom, r.categorie, r.tags, r.location, COALESCE(r.min,0), COALESCE(r.max,0),
         r.photo, r.npf, r.fournisseur, COALESCE(r.bus_std,false), COALESCE(r.bus_art,false),
         COALESCE(r.chimique,false), COALESCE(r.reparable,false), COALESCE(r.entretien,false),
         COALESCE(r.interne,false), COALESCE(r.stock_securite,0)
  FROM jsonb_populate_record(NULL::articles, p_data) r;
END;
$$;

-- Supprimer un article (soft delete → récupérable en SQL si erreur)
CREATE OR REPLACE FUNCTION magasin_delete_article(user_hash text, p_num text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM magasin_auth(user_hash);
  IF NOT FOUND OR NOT (a.u_role = 'admin' OR (a.u_role IN ('magasinier','brigadier') AND a.u_peut_modifier)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE articles SET supprime = true WHERE num = p_num;
END;
$$;

-- Ajouter/remplacer les photos d'un article (mode photo rapide)
CREATE OR REPLACE FUNCTION magasin_set_article_photo(user_hash text, p_num text, p_photo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM magasin_auth(user_hash);
  IF NOT FOUND OR a.u_role NOT IN ('admin','magasinier','brigadier') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE articles SET photo = p_photo WHERE num = p_num;
END;
$$;

-- ═══════════════════════ BONS DE COMMANDE ═══════════════════════

-- Créer un bon (tout utilisateur actif : agent, borne, magasinier...)
CREATE OR REPLACE FUNCTION magasin_create_bon(user_hash text, p_bon jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE a record; new_id bigint;
BEGIN
  SELECT * INTO a FROM magasin_auth(user_hash);
  IF NOT FOUND THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO bons_commande (numero_ordre, statut, articles, login, numero_agent,
                             message, preparation_statut, sap_effectue)
  SELECT r.numero_ordre, COALESCE(r.statut,'valide'), r.articles, r.login, r.numero_agent,
         r.message, COALESCE(r.preparation_statut,'en_prep'), COALESCE(r.sap_effectue,false)
  FROM jsonb_populate_record(NULL::bons_commande, p_bon) r
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- Modifier un bon (statut préparation, SAP fait, message/pris) — staff
CREATE OR REPLACE FUNCTION magasin_patch_bon(user_hash text, p_id text, p_patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM magasin_auth(user_hash);
  IF NOT FOUND OR a.u_role NOT IN ('admin','magasinier','brigadier') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE bons_commande SET
    preparation_statut = CASE WHEN p_patch ? 'preparation_statut' THEN p_patch->>'preparation_statut' ELSE preparation_statut END,
    sap_effectue       = CASE WHEN p_patch ? 'sap_effectue'       THEN (p_patch->>'sap_effectue')::boolean ELSE sap_effectue END,
    message            = CASE WHEN p_patch ? 'message'            THEN p_patch->>'message' ELSE message END,
    statut             = CASE WHEN p_patch ? 'statut'             THEN p_patch->>'statut' ELSE statut END
  WHERE id::text = p_id;
END;
$$;

-- Supprimer un bon — staff
CREATE OR REPLACE FUNCTION magasin_delete_bon(user_hash text, p_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM magasin_auth(user_hash);
  IF NOT FOUND OR a.u_role NOT IN ('admin','magasinier','brigadier') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM bons_commande WHERE id::text = p_id;
END;
$$;

-- Archivage auto des bons SAP-faits de plus de 7 jours — staff
CREATE OR REPLACE FUNCTION magasin_archive_bons(user_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM magasin_auth(user_hash);
  IF NOT FOUND OR a.u_role NOT IN ('admin','magasinier') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE bons_commande SET statut = 'archive'
  WHERE sap_effectue = true AND statut = 'valide'
    AND date_creation < now() - interval '7 days';
END;
$$;

-- ═══════════════════════ OUTILLAGE ═══════════════════════

-- Créer (p_id null) ou modifier (p_id renseigné) un outil — staff éditeur
CREATE OR REPLACE FUNCTION magasin_save_outil(user_hash text, p_id text, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM magasin_auth(user_hash);
  IF NOT FOUND OR NOT (a.u_role = 'admin' OR (a.u_role IN ('magasinier','brigadier') AND a.u_peut_modifier)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_id IS NULL OR p_id = '' THEN
    INSERT INTO outillage (nom, location, tags, photo)
    VALUES (p_data->>'nom', p_data->>'location', p_data->>'tags', p_data->>'photo');
  ELSE
    UPDATE outillage SET
      nom      = p_data->>'nom',
      location = p_data->>'location',
      tags     = p_data->>'tags',
      photo    = p_data->>'photo'
    WHERE id::text = p_id;
  END IF;
END;
$$;

-- Supprimer un outil — staff éditeur
CREATE OR REPLACE FUNCTION magasin_delete_outil(user_hash text, p_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM magasin_auth(user_hash);
  IF NOT FOUND OR NOT (a.u_role = 'admin' OR (a.u_role IN ('magasinier','brigadier') AND a.u_peut_modifier)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM outillage WHERE id::text = p_id;
END;
$$;

-- Workflow prêt : demande / annule (tous), pret / retour / accept / refuse (staff)
CREATE OR REPLACE FUNCTION magasin_outil_pret(user_hash text, p_id text, p_action text, p_agent text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE a record; is_staff boolean;
BEGIN
  SELECT * INTO a FROM magasin_auth(user_hash);
  IF NOT FOUND THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  is_staff := a.u_role IN ('admin','magasinier','brigadier');

  IF p_action = 'demande' THEN
    UPDATE outillage SET demande_par = COALESCE(p_agent, a.u_login), demande_date = now()
    WHERE id::text = p_id AND agent_pret IS NULL;

  ELSIF p_action = 'annule' THEN
    UPDATE outillage SET demande_par = NULL, demande_date = NULL WHERE id::text = p_id;

  ELSIF p_action = 'pret' THEN
    IF NOT is_staff THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    UPDATE outillage SET agent_pret = p_agent, date_pret = now() WHERE id::text = p_id;

  ELSIF p_action = 'retour' THEN
    IF NOT is_staff THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    UPDATE outillage SET agent_pret = NULL, date_pret = NULL WHERE id::text = p_id;

  ELSIF p_action = 'accept' THEN
    IF NOT is_staff THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    UPDATE outillage SET agent_pret = demande_par, date_pret = now(),
                         demande_par = NULL, demande_date = NULL
    WHERE id::text = p_id AND demande_par IS NOT NULL;

  ELSIF p_action = 'refuse' THEN
    IF NOT is_staff THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    UPDATE outillage SET demande_par = NULL, demande_date = NULL WHERE id::text = p_id;

  ELSE
    RAISE EXCEPTION 'Action inconnue: %', p_action;
  END IF;
END;
$$;

-- ─── Permissions d'exécution ───
GRANT EXECUTE ON FUNCTION magasin_save_article(text,text,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_delete_article(text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_set_article_photo(text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_create_bon(text,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_patch_bon(text,text,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_delete_bon(text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_archive_bons(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_save_outil(text,text,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_delete_outil(text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION magasin_outil_pret(text,text,text,text) TO anon, authenticated;

-- ─── 2. RÉVOCATION des écritures directes (le verrou) ───
-- Les lectures (SELECT) restent ouvertes ; les écritures ne passent
-- plus QUE par les fonctions ci-dessus.
REVOKE INSERT, UPDATE, DELETE ON TABLE articles      FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE bons_commande FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE outillage     FROM anon, authenticated;

-- ✅ Terminé. L'app v70+ utilise automatiquement ces fonctions.
