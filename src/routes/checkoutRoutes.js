import { Router } from "express";
import { createPreference } from "../controllers/checkoutController.js";

const router = Router();
router.post("/create-preference", createPreference);
export default router;
