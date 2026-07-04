import { supabase } from "../config/supabase.js";
import sharp from "sharp";

const RECIPE_VIDEO_BUCKET = "recipe-videos";
const MAX_RECIPE_VIDEO_BYTES = 45 * 1024 * 1024;
const VIDEO_MIME_EXTENSIONS = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov"
};
const VIDEO_EXTENSION_MIMES = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime"
};

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

const USAGE_CONTEXTS = new Set(["breakfast", "work", "lunch_dinner", "quick_snack"]);

function normalizeUsageContexts(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || "").trim()).filter((item) => USAGE_CONTEXTS.has(item)))];
}

function getErrorMessage(error, fallback) {
  return error?.message ? `${fallback}: ${error.message}` : fallback;
}

function parseVideoBase64(value) {
  const raw = String(value || "");
  if (!raw) return null;

  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return {
      contentType: match[1],
      buffer: Buffer.from(match[2], "base64")
    };
  }

  return {
    contentType: null,
    buffer: Buffer.from(raw, "base64")
  };
}

function sanitizeFileSegment(value, fallback = "video") {
  return String(value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || fallback;
}

async function ensureRecipeVideoBucket() {
  const { error } = await supabase.storage.createBucket(RECIPE_VIDEO_BUCKET, {
    public: true,
    fileSizeLimit: MAX_RECIPE_VIDEO_BYTES,
    allowedMimeTypes: Object.keys(VIDEO_MIME_EXTENSIONS)
  });

  if (error && !String(error.message || "").toLowerCase().includes("already exists")) {
    throw error;
  }

  if (error) {
    const { error: updateError } = await supabase.storage.updateBucket(RECIPE_VIDEO_BUCKET, {
      public: true,
      fileSizeLimit: MAX_RECIPE_VIDEO_BYTES,
      allowedMimeTypes: Object.keys(VIDEO_MIME_EXTENSIONS)
    });
    if (updateError) throw updateError;
  }
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
    weekly_guide_note: product.weekly_guide_note,
    usage_contexts: normalizeUsageContexts(product.usage_contexts)
  };

  if (isPublicRecipeProduct(product)) {
    publicProduct.ingredients = product.ingredients || "";
    publicProduct.preparation_method = product.preparation_method || "";
    publicProduct.preparation_video_url = product.preparation_video_url || "";
  }

  return publicProduct;
}

function normalizeProductVisibilityPatch(patch) {
  if (patch.is_gift_recipe === true) {
    patch.is_sellable = false;
    patch.category = "brinde";
  }

  if (patch.category === "brinde") {
    patch.is_sellable = false;
    patch.is_gift_recipe = true;
  }

  if (patch.is_sellable === true) {
    patch.is_gift_recipe = false;
    if (patch.category === "brinde") patch.category = null;
  }

  return patch;
}

export async function listProducts(req, res) {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
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

export async function listReplenishmentRequests(req, res) {
  try {
    const status = String(req.query.status || "open").toLowerCase();
    let query = supabase
      .from("replenishment_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json({
      ok: true,
      requests: data || []
    });
  } catch (e) {
    console.error("[listReplenishmentRequests]", e);
    return res.status(500).json({
      ok: false,
      message: getErrorMessage(e, "Erro ao listar reposições")
    });
  }
}

export async function resolveReplenishmentRequest(req, res) {
  try {
    const { id } = req.params;
    const status = String(req.body?.status || "resolved").toLowerCase();

    if (!["resolved", "canceled"].includes(status)) {
      return res.status(400).json({
        ok: false,
        message: "Status inválido para reposição."
      });
    }

    const { data, error } = await supabase
      .from("replenishment_requests")
      .update({
        status,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    return res.json({
      ok: true,
      request: data
    });
  } catch (e) {
    console.error("[resolveReplenishmentRequest]", e);
    return res.status(500).json({
      ok: false,
      message: getErrorMessage(e, "Erro ao atualizar reposição")
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
      usage_contexts,
      ingredients,
      preparation_method,
      preparation_video_url,
      reorder_min_quantity,
      reorder_quantity
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
    if (typeof usage_contexts !== "undefined") payload.usage_contexts = normalizeUsageContexts(usage_contexts);
    if (typeof ingredients !== "undefined") payload.ingredients = ingredients;
    if (typeof preparation_method !== "undefined") payload.preparation_method = preparation_method;
    if (typeof preparation_video_url !== "undefined") payload.preparation_video_url = preparation_video_url || null;
    if (typeof reorder_min_quantity !== "undefined") payload.reorder_min_quantity = parseInteger(reorder_min_quantity, 0);
    if (typeof reorder_quantity !== "undefined") payload.reorder_quantity = parseInteger(reorder_quantity, 0);

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
      usage_contexts,
      ingredients,
      preparation_method,
      preparation_video_url,
      reorder_min_quantity,
      reorder_quantity
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
    if (typeof usage_contexts !== "undefined") patch.usage_contexts = normalizeUsageContexts(usage_contexts);
    if (typeof ingredients !== "undefined") patch.ingredients = ingredients;
    if (typeof preparation_method !== "undefined") patch.preparation_method = preparation_method;
    if (typeof preparation_video_url !== "undefined") patch.preparation_video_url = preparation_video_url || null;
    if (typeof reorder_min_quantity !== "undefined") patch.reorder_min_quantity = parseInteger(reorder_min_quantity, 0);
    if (typeof reorder_quantity !== "undefined") patch.reorder_quantity = parseInteger(reorder_quantity, 0);

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

export async function uploadPreparationVideo(req, res) {
  try {
    const { id } = req.params;
    const fileName = sanitizeFileSegment(req.body?.file_name || "preparo.mp4");
    const parsed = parseVideoBase64(req.body?.data_base64);
    const extension = String(fileName.split(".").pop() || "").toLowerCase();
    const contentType = String(req.body?.content_type || parsed?.contentType || VIDEO_EXTENSION_MIMES[extension] || "").toLowerCase();

    if (!id) {
      return res.status(400).json({ ok: false, message: "Produto obrigatório." });
    }

    if (!parsed?.buffer?.length) {
      return res.status(400).json({ ok: false, message: "Arquivo de vídeo obrigatório." });
    }

    if (!VIDEO_MIME_EXTENSIONS[contentType]) {
      return res.status(400).json({ ok: false, message: "Formato de vídeo inválido. Use MP4, WebM ou MOV." });
    }

    if (parsed.buffer.length > MAX_RECIPE_VIDEO_BYTES) {
      return res.status(400).json({ ok: false, message: "Vídeo muito grande. Use até 45 MB para este teste." });
    }

    await ensureRecipeVideoBucket();

    const ext = VIDEO_MIME_EXTENSIONS[contentType];
    const baseName = fileName.replace(/\.[a-z0-9]+$/i, "") || "preparo";
    const path = `${sanitizeFileSegment(id, "produto")}/${Date.now()}-${baseName}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(RECIPE_VIDEO_BUCKET)
      .upload(path, parsed.buffer, {
        contentType,
        upsert: true,
        cacheControl: "3600"
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage
      .from(RECIPE_VIDEO_BUCKET)
      .getPublicUrl(path);

    const publicUrl = publicData?.publicUrl;
    if (!publicUrl) throw new Error("Não foi possível gerar URL pública do vídeo.");

    const productPatch = {
      preparation_video_url: publicUrl
    };

    if (typeof req.body?.category !== "undefined") productPatch.category = req.body.category || null;
    if (typeof req.body?.is_sellable !== "undefined") productPatch.is_sellable = parseBoolean(req.body.is_sellable);
    if (typeof req.body?.is_gift_recipe !== "undefined") productPatch.is_gift_recipe = parseBoolean(req.body.is_gift_recipe);

    const { data: product, error: updateError } = await supabase
      .from("products")
      .update(normalizeProductVisibilityPatch(productPatch))
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) throw updateError;

    return res.json({
      ok: true,
      video_url: publicUrl,
      video_path: path,
      product
    });
  } catch (e) {
    console.error("[uploadPreparationVideo]", e);
    return res.status(500).json({
      ok: false,
      message: getErrorMessage(e, "Erro ao enviar vídeo")
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





