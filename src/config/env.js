import dotenv from "dotenv";
dotenv.config();

export const env = {
  port: Number(process.env.PORT || 10000),
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  // Usando o domínio oficial como padrão, conforme sugerido
  frontendUrl: process.env.FRONTEND_URL || "https://www.tanamaofit.com.br",
  frontendSuccessUrl: process.env.FRONTEND_SUCCESS_URL || "https://www.tanamaofit.com.br/sucesso.html",
  frontendFailureUrl: process.env.FRONTEND_FAILURE_URL || "https://www.tanamaofit.com.br/falha.html",
  mercadoPagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  // A variável JWT_SECRET será lida do Render. O valor abaixo é apenas um fallback local.
  jwtSecret: process.env.JWT_SECRET || "chave_temporaria_desenvolvimento",
  webhookSecret: process.env.WEBHOOK_SECRET || ""
};
