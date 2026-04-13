import { Router } from "express";
import { createEmployee, listEmployees, updatePassword } from "../controllers/employeeController.js";
import { verifyToken, requireAdmin } from "../middlewares/authMiddleware.js";

const router = Router();
router.use(verifyToken); // Protege todas as rotas abaixo
router.get("/", requireAdmin, listEmployees);
router.post("/", requireAdmin, createEmployee);
router.put("/:id/password", updatePassword); // Admin ou próprio usuário

export default router;
