import { Router } from "express";
import { verifyToken, requireAdmin } from "../middlewares/authMiddleware.js";
import {
  createProductionRound,
  getProductionRound,
  listProductionRounds,
  recalculateProductionRound,
  updateProductionRoundStatus
} from "../controllers/productionRoundController.js";

const router = Router();
router.use(verifyToken);
router.use(requireAdmin);

router.get("/", listProductionRounds);
router.post("/", createProductionRound);
router.get("/:id", getProductionRound);
router.post("/:id/recalculate", recalculateProductionRound);
router.patch("/:id/status", updateProductionRoundStatus);

export default router;

