import { supabase } from "../config/supabase.js";

export async function listStock(req, res) {
  // Traz as compras e o nome do fornecedor vinculado
  const { data, error } = await supabase
    .from("stock_entries")
    .select(`*, suppliers(name)`)
    .order("created_at", { ascending: false });
    
  if (error) return res.status(500).json({ ok: false, message: error.message });
  return res.json({ ok: true, entries: data });
}

export async function createStock(req, res) {
  const { supplier_id, item_name, quantity, total_value, category } = req.body;
  const { error } = await supabase
    .from("stock_entries")
    .insert([{ supplier_id, item_name, quantity: Number(quantity), total_value: Number(total_value), category }]);
    
  if (error) return res.status(500).json({ ok: false, message: error.message });
  return res.json({ ok: true });
}
