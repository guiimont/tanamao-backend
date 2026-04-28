import { Router } from "express";
import {
  getOperationalData,
  updateOrderStatus,
  startProduction
} from "../controllers/operationalController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();
router.use(verifyToken);

router.get("/orders", getOperationalData);
router.patch("/orders/:id/status", updateOrderStatus);

// NOVO
router.post("/orders/:id/start-production", startProduction);

export default router;
