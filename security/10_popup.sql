-- ═══════════════════════════════════════════════════════════════════
-- MAGASIN 2K — Message popup d'alerte par article
-- ═══════════════════════════════════════════════════════════════════
-- Ajoute un champ `popup` sur les articles. S'il est renseigné, un
-- message d'alerte s'affiche quand la pièce est ajoutée au panier.
-- Met à jour magasin_save_article pour porter ce champ (+ parc déjà là).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE articles ADD COLUMN IF NOT EXISTS popup text;

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
                        interne, stock_securite, parc, popup)
  SELECT r.num, r.nom, r.categorie, r.tags, r.location, COALESCE(r.min,0), COALESCE(r.max,0),
         r.photo, r.npf, r.fournisseur, COALESCE(r.bus_std,false), COALESCE(r.bus_art,false),
         COALESCE(r.chimique,false), COALESCE(r.reparable,false), COALESCE(r.entretien,false),
         COALESCE(r.interne,false), COALESCE(r.stock_securite,0), COALESCE(r.parc,'citaro'), r.popup
  FROM jsonb_populate_record(NULL::articles, p_data) r;
END;
$$;

-- ✅ Terminé. L'app v84+ gère le message popup.
