import dotenv from "dotenv";
dotenv.config(); [cite: 5, 6]

export const env = {
  port: Number(process.env.PORT || 10000), [cite: 8]
  nodeEnv: process.env.NODE_ENV || "development", [cite: 8]
  isProduction: process.env.NODE_ENV === "production",
  frontendUrl: process.env.FRONTEND_URL || "https://www.tanamaofit.com.br", [cite: 8]
  frontendSuccessUrl: process.env.FRONTEND_SUCCESS_URL || "https://www.tanamaofit.com.br/sucesso.html", [cite: 8, 9]
  frontendFailureUrl: process.env.FRONTEND_FAILURE_URL || "https://www.tanamaofit.com.br/falha.html", [cite: 8, 10]
  mercadoPagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "", [cite: 13]
  supabaseUrl: process.env.SUPABASE_URL || "", [cite: 13]
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "", [cite: 13]
  jwtSecret: process.env.JWT_SECRET || "chave_super_secreta_tess_trocar_em_prod", [cite: 13, 14]
  webhookSecret: process.env.WEBHOOK_SECRET || "" [cite: 17]
}; [cite: 15]
