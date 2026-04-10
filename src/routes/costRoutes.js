import { Router } from "express";
import { listCosts, createCost } from "../controllers/costController.js";

const router = Router();

router.get("/", listCosts);
router.post("/", createCost);

export default router;
