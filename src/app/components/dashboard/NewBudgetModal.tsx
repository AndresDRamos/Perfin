"use client";

import { useState, type CSSProperties } from "react";
import { createBudgetAction, updateBudgetAction, deleteBudgetAction } from "@/app/actions/budgets";
import { createExpenseCategoryAction } from "@/app/actions/catalog";
import { MorphModal, type MorphClose } from "@/app/components/ui/MorphModal";
import { ModalSelect } from "@/app/components/ui/ModalSelect";
import { KitButton } from "@/app/components/ui/Button";
import {
  formatMontoInput,
  modalField,
  modalLabel,
  modalPill,
  montoInputToPesos,
  pesosToMontoInput,
  type OriginRect,
} from "@/app/components/ui/kit";

const NEW_VALUE = "__new__";

interface Props {
  origin: OriginRect;
  onClose: () => void;
  planId: number;
  expenseCategories: { id: number; name: string }[];
  // Categorías que ya tienen tope en el plan (se excluyen del alta).
  cappedCategoryIds: number[];
  // Presente → modo edición (solo cambia el límite).
  editing?: { budgetId: number; categoryId: number; categoryName: string; targetPesos: number };
  topInset?: number;
}

// "Nuevo presupuesto" / "Editar presupuesto" (kit NewBudgetModal.jsx) sobre el
// plan vigente: elige (o crea) una categoría de gasto y fija su tope mensual
// como budget category_cap. Editar permite ajustar el límite o eliminar el tope.
export function NewBudgetModal({ origin, onClose, planId, expenseCategories, cappedCategoryIds, editing, topInset = 0 }: Props) {
  const available = expenseCategories.filter((c) => !cappedCategoryIds.includes(c.id));
  const [catSel, setCatSel] = useState<string>(editing ? String(editing.categoryId) : (available[0] ? String(available[0].id) : NEW_VALUE));
  const [newName, setNewName] = useState("");
  const [limit, setLimit] = useState(editing ? pesosToMontoInput(editing.targetPesos) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const creatingNew = !editing && catSel === NEW_VALUE;
  const valid = montoInputToPesos(limit) > 0 && (editing || (creatingNew ? newName.trim() !== "" : catSel !== ""));

  async function submit(close: MorphClose) {
    if (!valid || pending) return;
    setPending(true);
    setError(null);

    let categoryId = editing ? editing.categoryId : Number(catSel);
    if (creatingNew) {
      const catRes = await createExpenseCategoryAction({ name: newName.trim() });
      if (!catRes.ok || !("id" in catRes)) {
        const first = "errors" in catRes && catRes.errors ? Object.values(catRes.errors).flat()[0] : null;
        setError(first ?? "No se pudo crear la categoría");
        setPending(false);
        return;
      }
      categoryId = (catRes as { id: number }).id;
    }

    const payload = {
      planId,
      subtype: "category_cap" as const,
      expenseCategoryId: categoryId,
      targetAmountPesos: montoInputToPesos(limit),
    };
    const res = editing
      ? await updateBudgetAction(editing.budgetId, payload)
      : await createBudgetAction(payload);

    setPending(false);
    if (res.ok) {
      close("success");
    } else {
      const first = res.errors ? Object.values(res.errors).flat()[0] : null;
      setError(first ?? "No se pudo guardar el presupuesto");
    }
  }

  async function remove(close: MorphClose) {
    if (!editing || pending) return;
    setPending(true);
    await deleteBudgetAction(editing.budgetId, planId);
    setPending(false);
    close("cancel");
  }

  return (
    <MorphModal
      origin={origin}
      onClose={onClose}
      title={editing ? "Editar presupuesto" : "Nuevo presupuesto"}
      height={editing ? 380 : 460}
      successMessage={editing ? "Presupuesto actualizado" : "Presupuesto creado"}
      topInset={topInset}
      actions={
        editing
          ? [{ icon: "mdi:trash-can-outline", label: "Eliminar tope", danger: true, onClick: (close) => remove(close) }]
          : []
      }
    >
      {(close) => (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", flex: 1, scrollbarWidth: "none" }}>
            {editing ? (
              <span style={{ ...modalPill, alignSelf: "flex-start" }}>
                <span style={{ color: "var(--text-muted)" }}>Categoría</span>
                <strong style={{ fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"] }}>
                  {editing.categoryName}
                </strong>
              </span>
            ) : (
              <>
                <div>
                  <label style={modalLabel}>Categoría de gasto</label>
                  <ModalSelect
                    value={catSel}
                    onChange={setCatSel}
                    placeholder="Elige una categoría"
                    options={[
                      ...available.map((c) => ({ value: String(c.id), label: c.name })),
                      { value: NEW_VALUE, label: "+ Nueva categoría…" },
                    ]}
                  />
                </div>
                {creatingNew && (
                  <div>
                    <label style={modalLabel}>Nombre de la categoría</label>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      maxLength={100}
                      placeholder="p. ej. Comida"
                      style={modalField}
                    />
                  </div>
                )}
              </>
            )}

            <div>
              <label style={modalLabel}>Límite del periodo (MXN)</label>
              <input
                value={limit}
                onChange={(e) => setLimit(formatMontoInput(e.target.value))}
                inputMode="numeric"
                placeholder="0.00"
                style={modalField}
              />
            </div>

            {error && <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--negative)" }}>{error}</p>}
          </div>

          <div style={{ paddingTop: 16 }}>
            <KitButton onClick={() => submit(close)} disabled={!valid || pending}>
              {pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear presupuesto"}
            </KitButton>
          </div>
        </>
      )}
    </MorphModal>
  );
}
