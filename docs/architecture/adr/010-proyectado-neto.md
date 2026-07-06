# 010. El "Proyectado" del dashboard es saldo neto

- Status: accepted
- Date: 2026-07-06

## Context

Desde el plan `0002-transactions-ledger` el dashboard mostraba dos lecturas del disponible
(ADR-001/STATE): *real* (saldos cleared de cuentas líquidas) y *proyectado* (real + ingresos
`projected`). La deuda de tarjetas de crédito se mostraba aparte, por fecha de pago, y **nunca**
se restaba del disponible.

Con datos reales el usuario señaló que "Proyectado" así definido responde una pregunta poco útil
("¿cuánto líquido tendré si llegan mis ingresos?") y no la que de verdad se hace al planear:
**"¿cuánto tengo de verdad, contando lo que debo?"**. Además, con los gastos fijos materializando
deuda de tarjeta automáticamente (misma sesión de plan), el número neto se vuelve el indicador
principal de salud financiera.

## Decision

La tarjeta "Proyectado" del dashboard muestra el **saldo neto**:

```
neto = disponible real (cash + débito + inversión, cleared)
     + ingresos proyectados (kind = income, status = projected, cuentas líquidas)
     − deuda de tarjetas (saldo derivado cleared de cuentas credit, firmado)
```

Implementado como `netProjected()` en `src/domain/available.ts`: suma el saldo firmado de las
cuentas `credit` al `projectedAvailable()` existente. Una tarjeta en deuda (saldo negativo) resta;
una tarjeta con saldo a favor suma. Los gastos proyectados sobre cuentas líquidas siguen
excluidos (no comprometidos hasta cleared). La tarjeta explica la fórmula en su leyenda
("Patrimonio + ingresos esperados − deuda").

`realAvailable()` y `projectedAvailable()` no cambian de semántica: la separación
disponible/deuda de ADR-001 sigue siendo el contrato del dominio; el neto es una lectura
*adicional*, no un reemplazo.

## Consequences

- **Easier**: el número principal del dashboard refleja patrimonio real; cargar un gasto fijo a
  la tarjeta (motor de recurrencia) baja el neto de inmediato, sin esperar al corte.
- **Harder**: "Proyectado" cambia de significado para quien ya usaba la app — mitigado con la
  leyenda de la fórmula en la propia tarjeta.
- **Live with**: el neto mezcla activos líquidos y pasivo de crédito en una sola cifra; para el
  detalle por cuenta está la sección "Patrimonio" (desglose por cuenta) y la de tarjetas.
