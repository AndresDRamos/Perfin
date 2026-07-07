-- Data fix (sin DDL): las tarjetas de crédito dadas de alta antes de este fix
-- capturaban la deuda como opening_balance POSITIVO (el onboarding pedía
-- "Saldo actual (deuda, si aplica)"), invirtiendo la convención de saldo
-- firmado del ledger (deuda = negativo). Efecto visible: el proyectado neto
-- (ADR-010) SUMABA la deuda y la sección de tarjetas mostraba montos en rojo
-- negativos. La captura quedó corregida en OnboardingWizard/AccountManager
-- (la deuda tecleada en positivo se guarda negada); esto repara las filas ya
-- existentes. Solo puede afectar filas creadas con la UX vieja: bajo la nueva
-- una tarjeta con deuda siempre nace con opening_balance <= 0.
-- Valores previos (dev, 2026-07-06), por si hiciera falta revertir a mano:
--   id 7 'Citi-1' 175290 · id 8 'Citi-2' 460844 · id 9 'Nu' 196189
UPDATE "account"
SET "opening_balance" = -"opening_balance"
WHERE "kind" = 'credit' AND "opening_balance" > 0;
