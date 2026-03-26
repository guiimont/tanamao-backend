import { Router } from "express";
import { listProducts } from "../controllers/productsController.js";

const router = Router();
router.get("/", listProducts);
export default router;
