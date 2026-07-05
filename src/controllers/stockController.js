import { supabase } from "../config/supabase.js";

function parseNumber(value) {
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return NaN;
    const normalized = raw.includes(",")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw;
    return Number(normalized);
  }
  return Number(value);
}

function normalizeStockEntry(input = {}, defaultSupplierId = null) {
  const supplierId = input.supplier_id || defaultSupplierId || null;
  const itemName = String(input.item_name || "").trim();
  const quantity = parseNumber(input.quantity);
  const totalInput = parseNumber(input.total_value);
  const unitCostInput = parseNumber(input.unit_cost);

  if (!itemName) throw new Error("Item obrigatorio.");
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Quantidade invalida para ${itemName}.`);
  }

  const hasUnitCost = Number.isFinite(unitCostInput) && unitCostInput >= 0;
  const hasTotal = Number.isFinite(totalInput) && totalInput >= 0;
  if (!hasUnitCost && !hasTotal) {
    throw new Error(`Informe valor por unidade ou valor total para ${itemName}.`);
  }

  const totalValue = Number((hasTotal ? totalInput : quantity * unitCostInput).toFixed(2));
  const unitCost = Number((hasUnitCost ? unitCostInput : totalValue / quantity).toFixed(4));

  return {
    supplier_id: supplierId,
    item_name: itemName,
    quantity,
    total_value: totalValue,
    unit_cost: unitCost,
    unit_type: input.unit_type || null,
    category: input.category || null,
    entry_date: input.entry_date || null
  };
}

export async function listStock(req, res) {
  const { data, error } = await supabase
    .from("stock_entries")
    .select("*, suppliers(name)")
    .order("entry_date", { ascending: false });

  if (error) return res.status(500).json({ ok: false, message: error.message });
  return res.json({ ok: true, entries: data });
}

export async function createStock(req, res) {
  let payload;
  try {
    payload = normalizeStockEntry(req.body);
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message });
  }

  const { error } = await supabase
    .from("stock_entries")
    .insert([payload]);

  if (error) return res.status(500).json({ ok: false, message: error.message });
  return res.json({ ok: true });
}

export async function createStockBatch(req, res) {
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  const supplierId = req.body?.supplier_id || null;

  if (!entries.length) {
    return res.status(400).json({ ok: false, message: "Nenhum item informado." });
  }

  let payload;
  try {
    payload = entries.map((entry) => normalizeStockEntry(entry, supplierId));
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message });
  }

  const { error } = await supabase
    .from("stock_entries")
    .insert(payload);

  if (error) return res.status(500).json({ ok: false, message: error.message });
  return res.status(201).json({ ok: true, count: payload.length });
}

export async function deleteStockBatch(req, res) {
  const ids = Array.isArray(req.body?.ids)
    ? [...new Set(req.body.ids.map((id) => String(id || "").trim()).filter(Boolean))]
    : [];
  const confirmToken = String(req.body?.confirm_token || "");

  if (confirmToken !== "DELETE_STOCK_ENTRIES") {
    return res.status(400).json({ ok: false, message: "Confirmacao invalida." });
  }

  if (!ids.length) {
    return res.status(400).json({ ok: false, message: "Nenhuma compra selecionada." });
  }

  if (ids.length > 500) {
    return res.status(400).json({ ok: false, message: "Limite de 500 registros por exclusao." });
  }

  const { data, error } = await supabase
    .from("stock_entries")
    .delete()
    .in("id", ids)
    .select("id");

  if (error) return res.status(500).json({ ok: false, message: error.message });
  return res.json({ ok: true, count: data?.length || 0 });
}
