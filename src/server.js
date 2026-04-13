import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";

import productRoutes from "./routes/productRoutes.js";
import checkoutRoutes from "./routes/checkoutRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import operationalRoutes from "./routes/operationalRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import costRoutes from "./routes/costRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js"; // ✅ Adicionado
import stockRoutes from "./routes/stockRoutes.js";       // ✅ Adicionado
import authRoutes from "./routes/authRoutes.js";         // ✅ Adicionado

const app = express();

app.set("trust proxy", true);
app.use(helmet());

// ✅ CORS TOTAL (REMOVE ERRO DE CONEXÃO)
app.use(cors({
  origin: "*",
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));

app.use(morgan("dev"));

// ✅ SUPORTE BASE64 (ESSENCIAL)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// ✅ ROTAS
app.use("/api/products", productRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/operations", operationalRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/costs", costRoutes);
app.use("/api/suppliers", supplierRoutes); // ✅ Adicionado
app.use("/api/stock", stockRoutes);        // ✅ Adicionado
app.use("/api/auth", authRoutes);          // ✅ Adicionado

// ✅ ERRO GLOBAL
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








