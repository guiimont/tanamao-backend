import { Router } from "express";
import { createProduct, deleteProduct, listProducts } from "../controllers/productsController.js";

const router = Router();

router.get("/", listProducts);
router.post("/", createProduct);
router.delete("/:id", deleteProduct);

export default router;

