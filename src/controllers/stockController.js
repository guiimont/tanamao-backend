import { supabase } from "../config/supabase.js";

export async function listStock(req, res) {
  // Traz as compras e o nome do fornecedor vinculado
  const { data, error } = await supabase
    .from("stock_entries")
    .select(`*, suppliers(name)`)
    .order("entry_date", { ascending: false });
    
  if (error) return res.status(500).json({ ok: false, message: error.message });
  return res.json({ ok: true, entries: data });
}

export async function createStock(req, res) {
  const { supplier_id, item_name, quantity, total_value, category, unit_type, entry_date } = req.body;

  const q = Number(quantity);
  const tv = Number(total_value);

  if (!item_name) return res.status(400).json({ ok: false, message: "Item obrigatório" });
  if (!Number.isFinite(q) || q <= 0) return res.status(400).json({ ok: false, message: "Quantidade inválida" });
  if (!Number.isFinite(tv) || tv < 0) return res.status(400).json({ ok: false, message: "Valor total inválido" });

  const unit_cost = Number((tv / q).toFixed(4));

  const { error } = await supabase
    .from("stock_entries")
    .insert([{
      supplier_id,
      item_name,
      quantity: q,
      total_value: tv,
      unit_cost,
      unit_type: unit_type || null,
      category: category || null,
      entry_date: entry_date || null
    }]);

  if (error) return res.status(500).json({ ok: false, message: error.message });
  return res.json({ ok: true });
}
