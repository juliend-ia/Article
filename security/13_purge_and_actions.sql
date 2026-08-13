-- ═══════════════════════════════════════════════════════════════════
-- MAGASIN 2K — Suppression définitive (corbeille) + correctif historique
-- ═══════════════════════════════════════════════════════════════════

-- 1. Suppression DÉFINITIVE d'un article de la corbeille (admin, irréversible)
--    Ne supprime que les articles déjà en corbeille (supprime = true) — sécurité.
CREATE OR REPLACE FUNCTION magasin_purge_article(admin_hash text, p_num text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $pa$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM magasin_auth(admin_hash);
  IF NOT FOUND OR a.u_role <> 'admin' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  DELETE FROM articles WHERE num = p_num AND supprime = true;
END;
$pa$;
GRANT EXECUTE ON FUNCTION magasin_purge_article(text,text) TO anon, authenticated;

-- 2. Correctif magasin_list_actions : casts explicites vers les types déclarés
--    (évite l'erreur "structure of query does not match function result type"
--     quand une colonne est varchar ou timestamp au lieu de text/timestamptz)
CREATE OR REPLACE FUNCTION magasin_list_actions(admin_hash text, p_limit int)
RETURNS TABLE(login text, prenom text, action text, details text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $la$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM magasin_auth(admin_hash);
  IF NOT FOUND OR a.u_role <> 'admin' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY
    SELECT h.login::text, h.prenom::text, h.action::text, h.details::text, h.created_at::timestamptz
    FROM historique_actions h
    ORDER BY h.created_at DESC
    LIMIT COALESCE(p_limit, 50);
END;
$la$;

-- ✅ Terminé.
