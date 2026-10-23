-- Caja de dólares (docs/PLAN_DOLARES.md). Va sola: un valor nuevo de un enum no
-- se puede usar en la misma transacción en que se crea.
ALTER TYPE "Caja" ADD VALUE 'dolares';
