import { Router } from "express";
import { listCosts, createCost } from "../controllers/costController.js";
// Importando a proteção
import { verifyToken, requireAdmin } from "../middlewares/authMiddleware.js";

const router = Router();

// Protegendo as rotas de custos
router.get("/", verifyToken, requireAdmin, listCosts);
router.post("/", verifyToken, requireAdmin, createCost);

export default router;
