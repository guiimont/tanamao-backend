import { Router } from "express";
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier } from "../controllers/supplierController.js";

const router = Router();
router.get("/", listSuppliers);
router.post("/", createSupplier);
router.put("/:id", updateSupplier);
router.delete("/:id", deleteSupplier);

export default router;
