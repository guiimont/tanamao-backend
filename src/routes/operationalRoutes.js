import { Router } from "express";
import { getOperationalData, updateOrderStatus } from "../controllers/operationalController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();

// Proteção no topo do router
router.use(verifyToken);

router.get("/orders", getOperationalData);

// NOVO: atualizar status do pedido (kanban)
router.patch("/orders/:id/status", updateOrderStatus);

export default router;
