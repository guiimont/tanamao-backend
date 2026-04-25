import express from "express"; [cite: 508]
import cors from "cors"; [cite: 508]
import helmet from "helmet"; [cite: 508]
import morgan from "morgan"; [cite: 508]
import { env } from "./config/env.js"; [cite: 509]

// Middlewares de Segurança
import { verifyToken, requireAdmin } from "./middlewares/authMiddleware.js"; [cite: 509]

// Rotas
import productRoutes from "./routes/productRoutes.js"; [cite: 510]
import checkoutRoutes from "./routes/checkoutRoutes.js"; [cite: 510]
import paymentRoutes from "./routes/paymentRoutes.js"; [cite: 510]
import operationalRoutes from "./routes/operationalRoutes.js"; [cite: 510]
import settingsRoutes from "./routes/settingsRoutes.js"; [cite: 510]
import costRoutes from "./routes/costRoutes.js"; [cite: 511]
import supplierRoutes from "./routes/supplierRoutes.js"; [cite: 511]
import stockRoutes from "./routes/stockRoutes.js"; [cite: 511]
import authRoutes from "./routes/authRoutes.js"; [cite: 511]

const app = express(); [cite: 511]

app.set("trust proxy", true); [cite: 512]
app.use(helmet()); [cite: 512]
app.use(cors({
  origin: "*",
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
})); [cite: 512]

// LOGS CONDICIONAIS:
// Em produção usa o formato 'combined' (padrão Apache, mais completo para análise de segurança)
// Em desenvolvimento usa o 'dev' (colorido e simplificado)
app.use(morgan(env.isProduction ? "combined" : "dev")); [cite: 512]

// SILENCIADOR DE LOGS (Opcional):
// Se quiser evitar que console.log poluam o log do Render em produção:
if (env.isProduction) {
  console.log = () => {}; 
  // Mantemos o console.error e console.warn ativos para debug de problemas reais
}

app.use(express.json({ limit: "50mb" })); [cite: 513]
app.use(express.urlencoded({ limit: "50mb", extended: true })); [cite: 513]

app.get("/health", (_req, res) => {
  res.json({ ok: true, env: env.nodeEnv }); [cite: 514]
});

// ROTAS PÚBLICAS
app.use("/api/auth", authRoutes); [cite: 515]
app.use("/api/products", productRoutes); [cite: 515]
app.use("/api/checkout", checkoutRoutes); [cite: 515]
app.use("/api/payments", paymentRoutes); [cite: 516]

// ROTAS DE OPERAÇÃO
app.use("/api/operations", verifyToken, operationalRoutes); [cite: 516]
app.use("/api/stock", verifyToken, stockRoutes); [cite: 517]

// ROTAS ADMINISTRATIVAS
app.use("/api/settings", verifyToken, requireAdmin, settingsRoutes); [cite: 517]
app.use("/api/costs", verifyToken, requireAdmin, costRoutes); [cite: 518]
app.use("/api/suppliers", verifyToken, requireAdmin, supplierRoutes); [cite: 518]

// Middleware de erro global
app.use((err, _req, res, _next) => {
  console.error("[server:error]", err); [cite: 518]
  return res.status(500).json({
    ok: false,
    message: env.isProduction ? "internal_server_error" : err.message
  });
});

app.listen(env.port, () => {
  console.log(`Backend rodando em modo ${env.nodeEnv} na porta ${env.port}`); [cite: 519]
});








