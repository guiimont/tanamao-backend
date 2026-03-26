import { listActiveProducts } from "../services/productService.js";

export async function listProducts(_req, res) {
  try {
    const products = await listActiveProducts();
    return res.json({ ok: true, products });
  } catch (error) {
    console.error("[products:list]", error);
    return res.status(500).json({ ok: false, message: "Erro ao listar produtos." });
  }
}
