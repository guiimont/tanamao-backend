import express from "express";
import {
  listProducts,
  listAdminProducts,
  listReplenishmentRequests,
  resolveReplenishmentRequest,
  createProduct,
  updateProduct,
  uploadPreparationVideo,
  deleteProduct
} from "../controllers/productsController.js";
import { verifyToken, requireAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public storefront list. Internal recipe fields are sanitized here.
router.get("/", listProducts);

// Full catalog for the operational panel.
router.get("/admin", verifyToken, requireAdmin, listAdminProducts);
router.get("/replenishment", verifyToken, requireAdmin, listReplenishmentRequests);
router.patch("/replenishment/:id", verifyToken, requireAdmin, resolveReplenishmentRequest);

// Admin-only catalog mutations.
router.post("/", verifyToken, requireAdmin, createProduct);
router.post("/:id/preparation-video", verifyToken, requireAdmin, uploadPreparationVideo);
router.put("/:id", verifyToken, requireAdmin, updateProduct);
router.delete("/:id", verifyToken, requireAdmin, deleteProduct);

export default router;
