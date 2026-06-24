import { Router } from "express";
import { getPublicSettings, getSettings, updateSettings } from "../controllers/settingsController.js";
import { verifyToken, requireAdmin } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/public/:key", getPublicSettings);

router.use(verifyToken);
router.use(requireAdmin);

router.get("/:key", getSettings);
router.put("/:key", updateSettings);

export default router;
