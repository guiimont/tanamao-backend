import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/settingsController.js";

const router = Router();

router.get("/:key", getSettings);
router.put("/:key", updateSettings);

export default router;
