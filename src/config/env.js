import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 10000),
  nodeEnv: process.env.NODE_ENV || "development",
  frontendUrl: process.env.FRONTEND_URL || "*",
  frontendSuccessUrl: process.env.FRONTEND_SUCCESS_URL || "https://tanamaofit.com.br/TanaMao/sucesso.html",
  frontendFailureUrl: process.env.FRONTEND_FAILURE_URL || "https://tanamaofit.com.br/TanaMao/falha.html",
  mercadoPagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ""
};
