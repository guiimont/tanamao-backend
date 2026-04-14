import { Router } from "express";
import { getOrders } from "../controllers/operationalController.js";
const router = Router();

router.get("/orders", getOrders);

export default router;
