import { supabase } from "../config/supabase.js";
import sharp from "sharp";

// ✅ NOVA FUNÇÃO: Otimização de Imagem (WebP, Max 800px, 80% Qualidade)
async function optimizeImage(base64Str) {
  if (!base64Str || !base64Str.startsWith('data:image')) return base64Str;

  try {
    const parts = base64Str.split(';base64,');
    const imageBuffer = Buffer.from(parts[1], 'base64');

    const optimizedBuffer = await sharp(imageBuffer)
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    return `data:image/webp;base64,${optimizedBuffer.toString('base64')}`;
  } catch (error) {
    console.error('[optimizeImage] Erro ao otimizar imagem:', error);
    return base64Str; // Fallback de segurança: salva a original se der erro
  }
}

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
    const {
      name,
      description,
      price,
      image_url,
      category,
      serving_size,
      shelf_life_days,
      storage_instructions,
      lead_time_hours,
      available_days,
      max_units_per_day,
      is_sellable,
      is_gift_recipe,
      weekly_guide_note
    } = req.body;

    if (!name) {
      return res.status(400).json({
        ok: false,
        message: "Nome obrigatório"
      });
    }

    // ✅ Otimiza a imagem antes de salvar
    const optimizedImageUrl = await optimizeImage(image_url);

    const payload = {
      name,
      description: description || "",
      price: Number(price) || 0,
      image_url: optimizedImageUrl || null
    };

    if (typeof category !== "undefined") payload.category = category;
    if (typeof serving_size !== "undefined") payload.serving_size = serving_size;
    if (typeof shelf_life_days !== "undefined") payload.shelf_life_days = Number(shelf_life_days) || null;
    if (typeof storage_instructions !== "undefined") payload.storage_instructions = storage_instructions;
    if (typeof lead_time_hours !== "undefined") payload.lead_time_hours = Number(lead_time_hours) || 24;
    if (Array.isArray(available_days)) payload.available_days = available_days;
    if (typeof max_units_per_day !== "undefined") payload.max_units_per_day = Number(max_units_per_day) || null;
    if (typeof is_sellable !== "undefined") payload.is_sellable = !!is_sellable;
    if (typeof is_gift_recipe !== "undefined") payload.is_gift_recipe = !!is_gift_recipe;
    if (typeof weekly_guide_note !== "undefined") payload.weekly_guide_note = weekly_guide_note;

    const { data, error } = await supabase
      .from("products")
      .insert([payload])
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

    const {
      name,
      description,
      price,
      image_url,
      active,
      sort_order,
      stock_quantity,
      category,
      serving_size,
      shelf_life_days,
      storage_instructions,
      lead_time_hours,
      available_days,
      max_units_per_day,
      is_sellable,
      is_gift_recipe,
      weekly_guide_note
    } = req.body;

    // Só otimiza imagem se veio alguma imagem (senão não mexe)
    const optimizedImageUrl = image_url ? await optimizeImage(image_url) : undefined;

    const patch = {};

    // Campos básicos
    if (typeof name !== "undefined") patch.name = name;
    if (typeof description !== "undefined") patch.description = description;
    if (typeof price !== "undefined") patch.price = Number(price) || 0;

    // Imagem (opcional)
    if (typeof image_url !== "undefined") {
      patch.image_url = optimizedImageUrl || null;
    }

    // Cardápio (opcional)
    if (typeof active !== "undefined") patch.active = !!active;
    if (typeof sort_order !== "undefined") patch.sort_order = Number(sort_order) || 0;
    if (typeof category !== "undefined") patch.category = category;
    if (typeof serving_size !== "undefined") patch.serving_size = serving_size;
    if (typeof shelf_life_days !== "undefined") patch.shelf_life_days = Number(shelf_life_days) || null;
    if (typeof storage_instructions !== "undefined") patch.storage_instructions = storage_instructions;
    if (typeof lead_time_hours !== "undefined") patch.lead_time_hours = Number(lead_time_hours) || 24;
    if (Array.isArray(available_days)) patch.available_days = available_days;
    if (typeof max_units_per_day !== "undefined") patch.max_units_per_day = Number(max_units_per_day) || null;
    if (typeof is_sellable !== "undefined") patch.is_sellable = !!is_sellable;
    if (typeof is_gift_recipe !== "undefined") patch.is_gift_recipe = !!is_gift_recipe;
    if (typeof weekly_guide_note !== "undefined") patch.weekly_guide_note = weekly_guide_note;

    // Estoque (opcional)
    if (typeof stock_quantity !== "undefined") {
      const sq = Number(stock_quantity);
      if (!Number.isFinite(sq) || sq < 0) {
        return res.status(400).json({ ok: false, message: "stock_quantity inválido." });
      }
      patch.stock_quantity = Math.floor(sq);
    }

    const { data, error } = await supabase
      .from("products")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    return res.json({ ok: true, product: data });
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





