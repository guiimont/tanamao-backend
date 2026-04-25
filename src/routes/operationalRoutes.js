import { Router } from "express";
import { getOperationalData } from "../controllers/operationalController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();

// Proteção no topo do router
router.use(verifyToken);

router.get("/panel", getOperationalData);

export default router;
