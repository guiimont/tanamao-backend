import { Router } from "express";
import { listStock, createStock } from "../controllers/stockController.js";

const router = Router();
router.get("/", listStock);
router.post("/", createStock);

export default router;
