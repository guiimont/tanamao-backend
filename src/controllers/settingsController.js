import { supabase } from "../config/supabase.js";

export async function getSettings(req, res) {
  try {
    const { key } = req.params;

    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .eq("key", key)
      .single();

    if (error) throw error;

    return res.json({ ok: true, data });
  } catch (e) {
    console.error("[settings:get]", e);
    return res.status(500).json({ ok: false });
  }
}

export async function updateSettings(req, res) {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const { error } = await supabase
      .from("settings")
      .update({ value })
      .eq("key", key);

    if (error) throw error;

    return res.json({ ok: true });
  } catch (e) {
    console.error("[settings:update]", e);
    return res.status(500).json({ ok: false });
  }
}
