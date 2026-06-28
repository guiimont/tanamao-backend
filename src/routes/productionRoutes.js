import { Router } from "express";
import { verifyToken, requireAdmin } from "../middlewares/authMiddleware.js";
import {
  archiveIngredient,
  createIngredient,
  createProductionBatch,
  generateShoppingList,
  listIngredients,
  listProductIngredients,
  replaceProductIngredients,
  updateIngredient
} from "../controllers/productionController.js";

const router = Router();
router.use(verifyToken);
router.use(requireAdmin);

router.get("/ingredients", listIngredients);
router.post("/ingredients", createIngredient);
router.put("/ingredients/:id", updateIngredient);
router.delete("/ingredients/:id", archiveIngredient);

router.get("/products/:productId/ingredients", listProductIngredients);
router.put("/products/:productId/ingredients", replaceProductIngredients);

router.post("/shopping-list", generateShoppingList);
router.post("/batch", createProductionBatch);

export default router;
