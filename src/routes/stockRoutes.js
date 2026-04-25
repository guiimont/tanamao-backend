import { Router } from "express";
import { listStock, createStock } from "../controllers/stockController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();

// Defesa em profundidade: exige login para qualquer rota de estoque
router.use(verifyToken);

router.get("/", listStock);
router.post("/", createStock);

export default router;
