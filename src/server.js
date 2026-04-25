import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";

// Importação das rotas
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import checkoutRoutes from "./routes/checkoutRoutes.js";
import operationalRoutes from "./routes/operationalRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import costRoutes from "./routes/costRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";

const app = express();

// 1. Configuração de Proxy (Essencial para Rate Limit no Render)
app.set("trust proxy", 1);

// 2. Segurança de Headers
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

// 3. FECHAMENTO DO CORS (Configuração Restritiva)
const allowedOrigins = [
  "https://www.tanamaofit.com.br",
  "https://tanamaofit.com.br"
];

// Adiciona localhost apenas se estiver em ambiente de desenvolvimento
if (process.env.NODE_ENV !== "production") {
  allowedOrigins.push("http://localhost:5500", "http://127.0.0.1:5500");
}

app.use(cors({
  origin: function (origin, callback) {
    // Permite requisições sem origin (como mobile apps ou ferramentas de teste tipo Postman) 
    // ou se a origin estiver na lista permitida
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Acesso negado pelo CORS: Origem não permitida."));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// 4. Rotas
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/operations", operationalRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/costs", costRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/settings", settingsRoutes);

// Rota de saúde para o Render
app.get("/health", (req, res) => res.status(200).send("OK"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`==> Servidor Tanamao ativo em: ${process.env.NODE_ENV || 'development'}`);
  console.log(`==> Porta: ${PORT}`);
});







