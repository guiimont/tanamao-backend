import { Router } from "express";
import { supabase } from "../config/supabase.js";

const router = Router();

// Rota: /api/operations/orders
router.get("/orders", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .neq("delivery_status", "delivered") // Filtra os entregues direto no banco
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.json({ ok: true, orders: data });
  } catch (err) {
    console.error("[getOrders:error]", err);
    return res.status(500).json({ ok: false, message: "Erro ao carregar pedidos" });
  }
});

export default router;
