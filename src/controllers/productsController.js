import { supabase } from "../config/supabase.js";

export async function listProducts(req, res) {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    return res.json({
      ok: true,
      products: data || []
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      ok: false,
      message: "Erro ao listar produtos"
    });
  }
}

export async function createProduct(req, res) {
  try {
    const { name, description, price, image_url } = req.body;

    if (!name) {
      return res.status(400).json({
        ok: false,
        message: "Nome obrigatório"
      });
    }

    const { data, error } = await supabase
      .from("products")
      .insert([{
        name,
        description: description || "",
        price: Number(price) || 0,
        image_url: image_url || null
      }])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      ok: true,
      product: data
    });
  } catch (e) {
    console.error("[createProduct]", e);
    return res.status(500).json({
      ok: false,
      message: "Erro ao criar produto"
    });
  }
}

export async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const { name, description, price, image_url } = req.body;

    const { error } = await supabase
      .from("products")
      .update({
        name,
        description,
        price: Number(price) || 0,
        image_url
      })
      .eq("id", id);

    if (error) throw error;

    return res.json({ ok: true });
  } catch (e) {
    console.error("[updateProduct]", e);
    return res.status(500).json({
      ok: false,
      message: "Erro ao atualizar"
    });
  }
}

export async function deleteProduct(req, res) {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return res.json({ ok: true });
  } catch (e) {
    console.error("[deleteProduct]", e);
    return res.status(500).json({
      ok: false,
      message: "Erro ao deletar"
    });
  }
}




