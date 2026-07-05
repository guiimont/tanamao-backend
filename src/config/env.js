import dotenv from "dotenv";
dotenv.config();

export const env = {
  // Configurações de Servidor
  port: Number(process.env.PORT || 10000),
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  
  // URLs de Navegação (Frontend)
  frontendUrl: process.env.FRONTEND_URL || "https://www.tanamaofit.com.br",
  frontendSuccessUrl: process.env.FRONTEND_SUCCESS_URL || "https://www.tanamaofit.com.br/sucesso.html",
  frontendFailureUrl: process.env.FRONTEND_FAILURE_URL || "https://www.tanamaofit.com.br/falha.html",
  
  // URL do Backend (Crucial para o Webhook do Mercado Pago)
  // No Render, configure BACKEND_URL como https://tanamao-backend.onrender.com
  backendUrl: process.env.BACKEND_URL || "http://localhost:10000",

  // Mercado Pago
  mercadoPagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
  webhookSecret: process.env.WEBHOOK_SECRET || "",

  // Supabase
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseKey: process.env.SUPABASE_KEY || "", // Use a Anon Key para operações comuns
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "", // Apenas para bypass de RLS

  // Segurança
  jwtSecret: process.env.JWT_SECRET || "chave_temporaria_desenvolvimento",

  // Recuperacao de senha do painel
  passwordResetTokenMinutes: Number(process.env.PASSWORD_RESET_TOKEN_MINUTES || 60),
  passwordResetFromEmail: process.env.PASSWORD_RESET_FROM_EMAIL || "Ta na Mao <no-reply@tanamaofit.com.br>",
  emailProvider: String(process.env.EMAIL_PROVIDER || "").trim().toLowerCase(),
  brevoApiKey: process.env.BREVO_API_KEY || "",
  resendApiKey: process.env.RESEND_API_KEY || "",

  // SMTP opcional para envio do link de recuperacao
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || ""
};
