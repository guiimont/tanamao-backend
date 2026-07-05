import { Router } from "express";
import { login, requestPasswordReset, resetPassword } from "../controllers/authController.js";
import { loginRateLimiter, passwordResetRateLimiter } from "../middlewares/rateLimitMiddleware.js";

const router = Router();

// Aplicamos o limiter apenas no POST de login
router.post("/login", loginRateLimiter, login);
router.post("/forgot-password", passwordResetRateLimiter, requestPasswordReset);
router.post("/reset-password", passwordResetRateLimiter, resetPassword);

export default router;
