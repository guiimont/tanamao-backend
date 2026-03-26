import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import productRoutes from "./routes/productRoutes.js";
import checkoutRoutes from "./routes/checkoutRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

const app = express();

app.set("trust proxy", true);
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (env.frontendUrl === "*" || origin.startsWith(env.frontendUrl)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  }
}));
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));

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

app.use((err, _req, res, _next) => {
  console.error("[server:error]", err);
  return res.status(500).json({ ok: false, message: err.message || "internal_server_error" });
});

app.listen(env.port, () => {
  console.log(`Tá na Mão! backend rodando na porta ${env.port}`);
});
