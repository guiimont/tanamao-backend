import rateLimit from "express-rate-limit";

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Janela de 15 minutos
  max: 5, // Limita cada IP a 5 tentativas de login por janela
  message: {
    ok: false,
    message: "Muitas tentativas de login. Por favor, tente novamente após 15 minutos."
  },
  standardHeaders: true, // Retorna info de limite nos headers `RateLimit-*`
  legacyHeaders: false, // Desativa os headers `X-RateLimit-*`
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    ok: false,
    message: "Muitas tentativas de recuperacao. Tente novamente apos alguns minutos."
  },
  standardHeaders: true,
  legacyHeaders: false
});
