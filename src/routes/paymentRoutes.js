import { Router } from "express";
import { paymentWebhook } from "../controllers/webhookController.js";

const router = Router();

router.post("/webhook", paymentWebhook);

export default router;
