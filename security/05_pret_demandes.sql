-- ═══════════════════════════════════════════════════════════════════
-- MAGASIN 2K — Workflow demande de prêt outillage
-- ═══════════════════════════════════════════════════════════════════
-- Ajoute 2 champs sur la table outillage pour gérer le workflow :
--   agent demande → magasinier accepte → outil marqué en prêt
-- ═══════════════════════════════════════════════════════════════════

-- Champ 1 : qui a fait la demande
ALTER TABLE outillage ADD COLUMN IF NOT EXISTS demande_par text;

-- Champ 2 : quand la demande a été faite
ALTER TABLE outillage ADD COLUMN IF NOT EXISTS demande_date timestamptz;

-- ✅ Workflow :
-- 1. Agent fait demande : UPDATE outillage SET demande_par='75067', demande_date=NOW() WHERE id=X
-- 2. Magasinier accepte : UPDATE outillage SET agent_pret=demande_par, date_pret=NOW(),
--                                demande_par=null, demande_date=null WHERE id=X
-- 3. Magasinier refuse  : UPDATE outillage SET demande_par=null, demande_date=null WHERE id=X
