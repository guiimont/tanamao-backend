import { supabase } from "../config/supabase.js";

const PUBLIC_SETTINGS_KEYS = new Set(["site_content"]);

export async function getPublicSettings(req, res) {
  try {
    const { key } = req.params;

    if (!PUBLIC_SETTINGS_KEYS.has(key)) {
      return res.status(404).json({ ok: false, message: "Configuração não encontrada." });
    }

    const { data, error } = await supabase
      .from("settings")
      .select("key, value")
      .eq("key", key)
      .maybeSingle();

    if (error) throw error;

    return res.json({ ok: true, data: data || { key, value: null } });
  } catch (e) {
    console.error("[settings:public:get]", e);
    return res.status(500).json({ ok: false });
  }
}

export async function getSettings(req, res) {
  try {
    const { key } = req.params;

    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .eq("key", key)
      .maybeSingle();

    if (error) throw error;

    return res.json({ ok: true, data: data || { key, value: null } });
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
      .upsert({ key, value }, { onConflict: "key" });

    if (error) throw error;

    return res.json({ ok: true });
  } catch (e) {
    console.error("[settings:update]", e);
    return res.status(500).json({ ok: false });
  }
}
