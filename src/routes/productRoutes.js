import express from "express";
import {
  listProducts,
  listAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct
} from "../controllers/productsController.js";
import { verifyToken, requireAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public storefront list. Internal recipe fields are sanitized here.
router.get("/", listProducts);

// Full catalog for the operational panel.
router.get("/admin", verifyToken, requireAdmin, listAdminProducts);

// Admin-only catalog mutations.
router.post("/", verifyToken, requireAdmin, createProduct);
router.put("/:id", verifyToken, requireAdmin, updateProduct);
router.delete("/:id", verifyToken, requireAdmin, deleteProduct);

export default router;
