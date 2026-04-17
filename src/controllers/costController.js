import { supabase } from "../config/supabase.js";

// Função que estava faltando e causando o erro no deploy
export async function listCosts(req, res) {
  try {
    const { data, error } = await supabase
      .from("costs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.json({ ok: true, data });
  } catch (err) {
    console.error("Erro ao listar custos:", err);
    return res.status(500).json({ ok: false, message: "Erro ao buscar dados" });
  }
}

// Sua função createCost que você já tinha
export async function createCost(req, res) {
  try {
    const { description, value, category } = req.body;

    const { data, error } = await supabase
      .from("costs")
      .insert([{ description, value, category }])
      .select()
      .single();

    if (error) {
      console.error("Erro ao inserir:", error);
      return res.status(500).json({ ok: false, message: error.message });
    }

    return res.json({ ok: true, data }); 
  } catch (err) {
    return res.status(500).json({ ok: false, message: "Erro interno" });
  }
}
