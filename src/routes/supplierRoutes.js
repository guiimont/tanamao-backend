import { Router } from "express";
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier } from "../controllers/supplierController.js";
import { verifyToken, requireAdmin } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(verifyToken);
router.use(requireAdmin);

router.get("/", listSuppliers);
router.post("/", createSupplier);
router.put("/:id", updateSupplier);
router.delete("/:id", deleteSupplier);

export default router;
