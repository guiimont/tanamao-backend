import { Router } from "express";
import { verifyToken, requireAdmin } from "../middlewares/authMiddleware.js";
import { createProductionBatch } from "../controllers/productionController.js";

const router = Router();
router.use(verifyToken);
router.use(requireAdmin);

router.post("/batch", createProductionBatch);

export default router;
