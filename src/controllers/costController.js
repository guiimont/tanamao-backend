import { supabase } from "../config/supabase.js";

export async function listCosts(req, res) {
  const { data, error } = await supabase
    .from("costs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ ok: false });

  return res.json({ ok: true, costs: data });
}

export async function createCost(req, res) {
  const { description, value, category } = req.body;

  const { error } = await supabase
    .from("costs")
    .insert([{ description, value, category }]);

  if (error) return res.status(500).json({ ok: false });

  return res.json({ ok: true });
}
