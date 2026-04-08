import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import productRoutes from "./routes/productRoutes.js";
import checkoutRoutes from "./routes/checkoutRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import operationalRoutes from "./routes/operationalRoutes.js";

const app = express();

app.set("trust proxy", true);
app.use(helmet());

// Configuração de CORS resiliente
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (env.frontendUrl === "*" || origin.startsWith(env.frontendUrl)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  }
}));

app.use(morgan("dev"));

// 🚀 A SOLUÇÃO DO SEU ERRO ESTÁ AQUI: Limite aumentado para suportar Base64
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "tanamao-backend",
    environment: env.nodeEnv,
    timestamp: new Date().toISOString()
  });
});

app.use("/api/products", productRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/operations", operationalRoutes);

app.use((err, _req, res, _next) => {
  console.error("[server:error]", err);
  return res.status(500).json({ ok: false, message: err.message || "internal_server_error" });
});

app.listen(env.port, () => {
  console.log(`Tá na Mão! Backend rodando na porta ${env.port} com limite de 50MB`);
});




