import express from "express";
import { 
  listProducts, 
  createProduct, 
  updateProduct, 
  deleteProduct 
} from "../controllers/productsController.js";
import { verifyToken, requireAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Aberto ao público (Vitrine da Loja)
router.get("/", listProducts);

// Protegido: Apenas Admin pode alterar o catálogo
router.post("/", verifyToken, requireAdmin, createProduct);
router.put("/:id", verifyToken, requireAdmin, updateProduct);
router.delete("/:id", verifyToken, requireAdmin, deleteProduct);

export default router;


