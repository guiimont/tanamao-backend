import { supabase } from "../config/supabase.js";
import { listActiveProducts } from "../services/productService.js";

// LISTAR
export async function listProducts(_req, res) {
  try {
    const products = await listActiveProducts();
    return res.json({ ok: true, products });
  } catch (error) {
    console.error("[products:list]", error);
    return res.status(500).json({ ok: false, message: "Erro ao listar produtos." });
  }
}

// CRIAR
export async function createProduct(req, res) {
  try {
    const { name, description, price, image_url } = req.body;

    const { error } = await supabase
      .from("products")
      .insert([{
        name,
        description: description || "",
        price: price || 0,
        image_url: image_url || ""
      }]);

    if (error) {
      console.error("[products:create]", error);
      return res.status(500).json({ ok: false });
    }

    return res.json({ ok: true });

  } catch (err) {
    console.error("[products:create]", err);
    return res.status(500).json({ ok: false });
  }
}

// DELETAR
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
}


