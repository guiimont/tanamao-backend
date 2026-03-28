import { Router } from "express";
import { listOperationalOrders, updateOrderStatusById } from "../services/orderService.js";

const router = Router();

router.get("/orders", async (req, res) => {
  try {
    const orders = await listOperationalOrders();
    return res.status(200).json({ ok: true, orders });
  } catch (error) {
    console.error("[operations:listOrders]", error);
    return res.status(500).json({ ok: false, message: "Erro ao listar pedidos." });
  }
});

router.patch("/orders/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { delivery_status } = req.body || {};

    const allowed = ["pending", "preparing", "ready", "out_for_delivery", "delivered"];
    if (!allowed.includes(delivery_status)) {
      return res.status(400).json({ ok: false, message: "Status inválido." });
    }

    const order = await updateOrderStatusById(id, { delivery_status });
    return res.status(200).json({ ok: true, order });
  } catch (error) {
    console.error("[operations:updateStatus]", error);
    return res.status(500).json({ ok: false, message: "Erro ao atualizar status." });
  }
});

export default router;
