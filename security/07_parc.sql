-- ═══════════════════════════════════════════════════════════════════
-- MAGASIN 2K — Séparation des catalogues par parc de bus
-- ═══════════════════════════════════════════════════════════════════
-- Ajoute un champ `parc` sur les articles (et les bons) pour séparer
-- le catalogue Citaro du catalogue Iveco.
--   'citaro' (défaut → tout l'existant reste Citaro)
--   'iveco'
--   'commun' (pièce visible dans les deux catalogues)
-- Aucune donnée perdue : le DEFAULT met tout l'existant en 'citaro'.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Colonnes parc
ALTER TABLE articles      ADD COLUMN IF NOT EXISTS parc text DEFAULT 'citaro';
ALTER TABLE bons_commande ADD COLUMN IF NOT EXISTS parc text;
UPDATE articles SET parc = 'citaro' WHERE parc IS NULL;

-- 2. RPC magasin_save_article : inclure le champ parc
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
                        interne, stock_securite, parc)
  SELECT r.num, r.nom, r.categorie, r.tags, r.location, COALESCE(r.min,0), COALESCE(r.max,0),
         r.photo, r.npf, r.fournisseur, COALESCE(r.bus_std,false), COALESCE(r.bus_art,false),
         COALESCE(r.chimique,false), COALESCE(r.reparable,false), COALESCE(r.entretien,false),
         COALESCE(r.interne,false), COALESCE(r.stock_securite,0), COALESCE(r.parc,'citaro')
  FROM jsonb_populate_record(NULL::articles, p_data) r;
END;
$$;

-- 3. RPC magasin_create_bon : inclure le champ parc
CREATE OR REPLACE FUNCTION magasin_create_bon(user_hash text, p_bon jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE a record; new_id bigint;
BEGIN
  SELECT * INTO a FROM magasin_auth(user_hash);
  IF NOT FOUND THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO bons_commande (numero_ordre, statut, articles, login, numero_agent,
                             message, preparation_statut, sap_effectue, parc)
  SELECT r.numero_ordre, COALESCE(r.statut,'valide'), r.articles, r.login, r.numero_agent,
         r.message, COALESCE(r.preparation_statut,'en_prep'), COALESCE(r.sap_effectue,false),
         COALESCE(r.parc,'citaro')
  FROM jsonb_populate_record(NULL::bons_commande, p_bon) r
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- ✅ Terminé. L'app v80+ utilise ce champ pour séparer les catalogues.
