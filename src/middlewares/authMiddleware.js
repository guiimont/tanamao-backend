import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  
  
if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, message: "Acesso negado. Token não fornecido." });
  }

  const token = authHeader.split(" ")[1];

  

try {
    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = decoded; // Injeta { id, email, role } na requisição
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: "Sessão expirada ou token inválido." });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ ok: false, message: "Acesso negado. Requer privilégios de administrador." });
  }
  next();
}
