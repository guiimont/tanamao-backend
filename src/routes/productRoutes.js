import { Router } from "express";
import { createProduct, deleteProduct, listProducts, updateProduct } from "../controllers/productsController.js";

const router = Router();

router.get("/", listProducts);
router.post("/", createProduct);
router.put("/:id", updateProduct); // ✅ ADICIONADO
router.delete("/:id", deleteProduct);

export default router;


