-- IRREVERSIBLE: destroys display_name values (the username is the only name
-- from here on). Backup of the 3 dev rows, taken 2026-07-04 by the dba review:
--   ana_ramos   -> 'Ana Ramos'
--   carlosperez -> 'Carlos Pérez'
--   aramos      -> 'Andrés Ramos'
ALTER TABLE "profile" DROP COLUMN "display_name";