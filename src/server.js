import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";

// Middlewares
import { verifyToken, requireAdmin } from "./middlewares/authMiddleware.js";

// Rotas
import productRoutes from "./routes/productRoutes.js";
import checkoutRoutes from "./routes/checkoutRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import operationalRoutes from "./routes/operationalRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import costRoutes from "./routes/costRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import authRoutes from "./routes/authRoutes.js";

const app = express();

app.set("trust proxy", true);

// Segurança e CORS
app.use(helmet());
app.use(cors({
  origin: env.frontendUrl, // Agora restringindo ao seu domínio oficial
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Logs baseados no ambiente
app.use(morgan(env.isProduction ? "combined" : "dev"));

// Desativa logs de console comuns em produção para limpar o terminal do Render
if (env.isProduction) {
  console.log = () => {};
}

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Rota de verificação de saúde do sistema
app.get("/health", (_req, res) => {
  res.json({ 
    ok: true, 
    environment: env.nodeEnv,
    timestamp: new Date().toISOString()
  });
});

// Definição das Rotas
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/payments", paymentRoutes);

// Rotas protegidas (Operacional)
app.use("/api/operations", verifyToken, operationalRoutes);
app.use("/api/stock", verifyToken, stockRoutes);

// Rotas protegidas (Administrativo)
app.use("/api/settings", verifyToken, requireAdmin, settingsRoutes);
app.use("/api/costs", verifyToken, requireAdmin, costRoutes);
app.use("/api/suppliers", verifyToken, requireAdmin, supplierRoutes);

// Tratamento de erros global
app.use((err, _req, res, _next) => {
  console.error("[ERRO CRÍTICO]:", err.stack);
  res.status(500).json({
    ok: false,
    message: env.isProduction ? "Erro interno no servidor." : err.message
  });
});

app.listen(env.port, () => {
  console.info(`==> Servidor Tanamao ativo em: ${env.nodeEnv}`);
  console.info(`==> Porta: ${env.port}`);
});








