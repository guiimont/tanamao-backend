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
export async function deleteProduct(req, res) {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[products:delete]", error);
      return res.status(500).json({
        ok: false,
        message: "Erro ao excluir produto."
      });
    }

    return res.json({ ok: true });

  } catch (err) {
    console.error("[products:delete]", err);
    return res.status(500).json({
      ok: false,
      message: "Erro inesperado ao excluir produto."
    });
  }
    async function createProduct(req, res) {
  try {
    const { name, description, price, image_url } = req.body;

    const { error } = await supabase
      .from("products")
      .insert([{ name, description, price, image_url }]);

    if (error) return res.status(500).json({ ok:false });

    res.json({ ok:true });

  } catch (err) {
    res.status(500).json({ ok:false });
  }
}

module.exports = { createProduct };

