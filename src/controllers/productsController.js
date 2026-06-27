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

function makeProductId(name) {
  const slug = String(name || "produto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "produto";

  return `${slug}-${Date.now().toString(36)}`;
}

function parseDecimal(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = typeof value === "string" ? value.trim().replace(",", ".") : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseInteger(value, fallback = null) {
  const parsed = parseDecimal(value, fallback);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function parseBoolean(value, fallback = false) {
  if (typeof value === "undefined") return fallback;
  if (typeof value === "string") return value === "true";
  return !!value;
}

function getErrorMessage(error, fallback) {
  return error?.message ? `${fallback}: ${error.message}` : fallback;
}

function isPublicRecipeProduct(product) {
  const category = String(product?.category || "").toLowerCase();
  return product?.active !== false
    && product?.is_sellable === false
    && (product?.is_gift_recipe === true || category === "brinde");
}

function sanitizePublicProduct(product) {
  const publicProduct = {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    image_url: product.image_url,
    active: product.active,
    sort_order: product.sort_order,
    category: product.category,
    serving_size: product.serving_size,
    shelf_life_days: product.shelf_life_days,
    storage_instructions: product.storage_instructions,
    lead_time_hours: product.lead_time_hours,
    available_days: product.available_days,
    max_units_per_day: product.max_units_per_day,
    is_sellable: product.is_sellable,
    is_gift_recipe: product.is_gift_recipe,
    weekly_guide_note: product.weekly_guide_note
  };

  if (isPublicRecipeProduct(product)) {
    publicProduct.ingredients = product.ingredients || "";
    publicProduct.preparation_method = product.preparation_method || "";
  }

  return publicProduct;
}

export async function listProducts(req, res) {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, description, price, image_url, active, sort_order, category, serving_size, shelf_life_days, storage_instructions, lead_time_hours, available_days, max_units_per_day, is_sellable, is_gift_recipe, weekly_guide_note, ingredients, preparation_method")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    return res.json({
      ok: true,
      products: (data || []).map(sanitizePublicProduct)
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      ok: false,
      message: "Erro ao listar produtos"
    });
  }
}

export async function listAdminProducts(req, res) {
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
      id,
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
      weekly_guide_note,
      ingredients,
      preparation_method
    } = req.body;

    if (!name) {
      return res.status(400).json({
        ok: false,
        message: "Nome obrigatório"
      });
    }

    // ✅ Otimiza a imagem antes de salvar
    const parsedPrice = parseDecimal(price, 0);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({
        ok: false,
        message: "Preço inválido"
      });
    }

    const optimizedImageUrl = await optimizeImage(image_url);

    const payload = {
      id: id || makeProductId(name),
      name,
      description: description || "",
      price: parsedPrice,
      image_url: optimizedImageUrl || null,
      active: parseBoolean(active, true),
      sort_order: parseInteger(sort_order, 0),
      stock_quantity: parseInteger(stock_quantity, 0)
    };

    if (typeof category !== "undefined") payload.category = category;
    if (typeof serving_size !== "undefined") payload.serving_size = serving_size;
    if (typeof shelf_life_days !== "undefined") payload.shelf_life_days = parseInteger(shelf_life_days, null);
    if (typeof storage_instructions !== "undefined") payload.storage_instructions = storage_instructions;
    if (typeof lead_time_hours !== "undefined") payload.lead_time_hours = parseInteger(lead_time_hours, 24);
    if (Array.isArray(available_days)) payload.available_days = available_days;
    if (typeof max_units_per_day !== "undefined") payload.max_units_per_day = parseInteger(max_units_per_day, null);
    if (typeof is_sellable !== "undefined") payload.is_sellable = parseBoolean(is_sellable);
    if (typeof is_gift_recipe !== "undefined") payload.is_gift_recipe = parseBoolean(is_gift_recipe);
    if (typeof weekly_guide_note !== "undefined") payload.weekly_guide_note = weekly_guide_note;
    if (typeof ingredients !== "undefined") payload.ingredients = ingredients;
    if (typeof preparation_method !== "undefined") payload.preparation_method = preparation_method;

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
      message: getErrorMessage(e, "Erro ao criar produto")
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
      weekly_guide_note,
      ingredients,
      preparation_method
    } = req.body;

    // Só otimiza imagem se veio alguma imagem (senão não mexe)
    const optimizedImageUrl = image_url ? await optimizeImage(image_url) : undefined;

    const patch = {};

    // Campos básicos
    if (typeof name !== "undefined") patch.name = name;
    if (typeof description !== "undefined") patch.description = description;
    if (typeof price !== "undefined") {
      const parsedPrice = parseDecimal(price, 0);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ ok: false, message: "Preço inválido" });
      }
      patch.price = parsedPrice;
    }

    // Imagem (opcional)
    if (typeof image_url !== "undefined") {
      patch.image_url = optimizedImageUrl || null;
    }

    // Cardápio (opcional)
    if (typeof active !== "undefined") patch.active = parseBoolean(active);
    if (typeof sort_order !== "undefined") patch.sort_order = parseInteger(sort_order, 0);
    if (typeof category !== "undefined") patch.category = category;
    if (typeof serving_size !== "undefined") patch.serving_size = serving_size;
    if (typeof shelf_life_days !== "undefined") patch.shelf_life_days = parseInteger(shelf_life_days, null);
    if (typeof storage_instructions !== "undefined") patch.storage_instructions = storage_instructions;
    if (typeof lead_time_hours !== "undefined") patch.lead_time_hours = parseInteger(lead_time_hours, 24);
    if (Array.isArray(available_days)) patch.available_days = available_days;
    if (typeof max_units_per_day !== "undefined") patch.max_units_per_day = parseInteger(max_units_per_day, null);
    if (typeof is_sellable !== "undefined") patch.is_sellable = parseBoolean(is_sellable);
    if (typeof is_gift_recipe !== "undefined") patch.is_gift_recipe = parseBoolean(is_gift_recipe);
    if (typeof weekly_guide_note !== "undefined") patch.weekly_guide_note = weekly_guide_note;
    if (typeof ingredients !== "undefined") patch.ingredients = ingredients;
    if (typeof preparation_method !== "undefined") patch.preparation_method = preparation_method;

    // Estoque (opcional)
    if (typeof stock_quantity !== "undefined") {
      const sq = parseInteger(stock_quantity, null);
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
      message: getErrorMessage(e, "Erro ao atualizar")
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

    if (!error) {
      return res.json({ ok: true, deleted: true });
    }

    console.warn("[deleteProduct] hard delete failed, archiving product instead", error);

    const { data, error: archiveError } = await supabase
      .from("products")
      .update({
        active: false,
        is_sellable: false,
        is_gift_recipe: false,
        category: "arquivado"
      })
      .eq("id", id)
      .select("id")
      .single();

    if (archiveError) throw archiveError;

    return res.json({
      ok: true,
      deleted: false,
      archived: true,
      product: data,
      message: "Produto removido do cardápio e arquivado para preservar o histórico."
    });
  } catch (e) {
    console.error("[deleteProduct]", e);
    return res.status(500).json({
      ok: false,
      message: getErrorMessage(e, "Erro ao deletar")
    });
  }
}





