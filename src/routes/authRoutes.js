import { Router } from "express";
import { login } from "../controllers/authController.js";
import { loginRateLimiter } from "../middlewares/rateLimitMiddleware.js";

const router = Router();

// Aplicamos o limiter apenas no POST de login
router.post("/login", loginRateLimiter, login);

export default router;
