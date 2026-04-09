import express from "express";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct
} from "../controllers/productsController.js";

const router = express.Router();

router.get("/", listProducts);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

export default router;


