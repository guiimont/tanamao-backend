import { supabase } from "../config/supabase.js";

export async function listSuppliers(req, res) {
  const { data, error } = await supabase.from("suppliers").select("*").order("name");
  if (error) return res.status(500).json({ ok: false, message: error.message });
  return res.json({ ok: true, suppliers: data });
}

export async function createSupplier(req, res) {
  const { name, contact, document } = req.body;
  const { error } = await supabase.from("suppliers").insert([{ name, contact, document }]);
  if (error) return res.status(500).json({ ok: false, message: error.message });
  return res.json({ ok: true });
}

export async function updateSupplier(req, res) {
  const { id } = req.params;
  const { name, contact, document } = req.body;
  const { error } = await supabase.from("suppliers").update({ name, contact, document }).eq("id", id);
  if (error) return res.status(500).json({ ok: false });
  return res.json({ ok: true });
}

export async function deleteSupplier(req, res) {
  const { id } = req.params;
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) return res.status(500).json({ ok: false });
  return res.json({ ok: true });
}
