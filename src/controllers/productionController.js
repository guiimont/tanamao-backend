import { supabase } from "../config/supabase.js";

export const createProductionBatch = async (req, res) => {
  try {
    const { items, note } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, message: "items vazio." });
    }

    const rows = [];
    for (const it of items) {
      const product_id = String(it.product_id || "").trim();
      const qty = Number(it.qty);

      if (!product_id) continue;
      if (!Number.isFinite(qty) || qty <= 0) continue;

      rows.push({
        product_id,
        qty_delta: Math.trunc(qty),
        reason: "production",
        reference: (it.note || note || null),
        created_by: req.user?.id || null,
      });
    }

    if (rows.length === 0) {
      return res.status(400).json({ ok: false, message: "Nenhuma linha válida (qty > 0)." });
    }

    const { error } = await supabase
      .from("product_stock_movements")
      .insert(rows);

    if (error) throw error;

    return res.json({ ok: true, inserted: rows.length });
  } catch (e) {
    console.error("[createProductionBatch]", e?.message || e);
    return res.status(500).json({ ok: false, message: "Erro ao lançar produção." });
  }
};
