-- ═══════════════════════════════════════════════════════════════════
-- MAGASIN 2K — ÉTAPE C : Activer le Row Level Security (RLS)
-- ═══════════════════════════════════════════════════════════════════
-- À EXÉCUTER APRÈS QUE LA NOUVELLE VERSION DE L'APP A ÉTÉ DÉPLOYÉE
-- → Bloque la lecture/écriture directe de la table utilisateurs
-- → Les fonctions RPC continueront de fonctionner (SECURITY DEFINER)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Activer RLS sur la table utilisateurs (CRITIQUE)
ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;
-- Pas de policy = aucun accès direct depuis l'app (anon/authenticated)
-- Seules les fonctions SECURITY DEFINER peuvent lire/écrire

-- 2. Activer RLS sur les autres tables — lecture publique, écriture publique pour l'instant
--    (Pour bloquer l'écriture il faudrait passer à Supabase Auth)

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "articles_public" ON articles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE outillage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outillage_public" ON outillage FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE bons_commande ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bons_public" ON bons_commande FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE historique_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "histo_public" ON historique_actions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE demandes_compte ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demande_compte_public" ON demandes_compte FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE demandes_reset ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demande_reset_public" ON demandes_reset FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Si messages existe
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    EXECUTE 'ALTER TABLE messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "messages_public" ON messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ✅ FIN ÉTAPE C
-- Après ça :
--   ✓ Plus AUCUN accès aux password_hash depuis l'extérieur
--   ✓ Plus de fuite de la table utilisateurs
--   ✓ L'app continue de fonctionner via les RPC
--
-- À tester :
--   curl https://...supabase.co/rest/v1/utilisateurs?select=* -H "apikey: ..."
--   → doit retourner [] (vide) au lieu de la liste complète
