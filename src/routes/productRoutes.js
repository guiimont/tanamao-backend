import express from "express";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct
} from "../controllers/productsController.js";
// Importando a proteção
import { verifyToken, requireAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Aberto ao público (Loja)
router.get("/", listProducts);

// Protegido (Só Admin logado pode mexer no estoque/preço)
router.post("/", verifyToken, requireAdmin, createProduct);
router.put("/:id", verifyToken, requireAdmin, updateProduct);
router.delete("/:id", verifyToken, requireAdmin, deleteProduct);

export default router;


