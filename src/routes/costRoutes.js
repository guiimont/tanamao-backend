import { Router } from "express";
import { listCosts, createCost } from "../controllers/costController.js";
import { verifyToken, requireAdmin } from "../middlewares/authMiddleware.js";

const router = Router();

// Camada dupla de proteção para finanças
router.use(verifyToken);
router.use(requireAdmin);

router.get("/", listCosts);
router.post("/", createCost);

export default router;
