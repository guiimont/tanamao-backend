import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";

// Middlewares de Segurança
import { verifyToken, requireAdmin } from "./middlewares/authMiddleware.js"; 

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
app.use(helmet());

app.use(cors({
  origin: "*",
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));

app.use(morgan("dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// ✅ ROTAS PÚBLICAS (Cliente final acessa sem login)
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes); // Listagem de marmitas
app.use("/api/checkout", checkoutRoutes); // Gerar link de pagamento
app.use("/api/payments", paymentRoutes); // Webhook do Mercado Pago

// ✅ ROTAS DE OPERAÇÃO (Admin + Operador)
// Requer apenas estar logado
app.use("/api/operations", verifyToken, operationalRoutes);
app.use("/api/stock", verifyToken, stockRoutes);

// ✅ ROTAS ADMINISTRATIVAS (Apenas Admin)
// Requer estar logado E ser admin
app.use("/api/settings", verifyToken, requireAdmin, settingsRoutes);
app.use("/api/costs", verifyToken, requireAdmin, costRoutes);
app.use("/api/suppliers", verifyToken, requireAdmin, supplierRoutes);

app.use((err, _req, res, _next) => {
  console.error("[server:error]", err);
  return res.status(500).json({
    ok: false,
    message: err.message || "internal_server_error"
  });
});

app.listen(env.port, () => {
  console.log(`Backend rodando na porta ${env.port}`);
});








