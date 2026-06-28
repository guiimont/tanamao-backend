import { supabase } from "../config/supabase.js";

function parseQuantity(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(typeof value === "string" ? value.replace(",", ".") : value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeUnit(value, fallback = "un") {
  const unit = String(value || "").trim().toLowerCase();
  return unit || fallback;
}

function normalizeProductionItems(items = []) {
  if (!Array.isArray(items)) return [];
  const byProduct = new Map();

  for (const item of items) {
    const productId = String(item.product_id || item.id || "").trim();
    const qty = parseQuantity(item.quantity ?? item.qty, 0);
    if (!productId || !Number.isFinite(qty) || qty <= 0) continue;
    byProduct.set(productId, Number(((byProduct.get(productId) || 0) + qty).toFixed(4)));
  }

  return [...byProduct.entries()].map(([product_id, quantity]) => ({ product_id, quantity }));
}

function roundQuantity(value) {
  return Number(Number(value || 0).toFixed(4));
}

function formatError(error, fallback) {
  return error?.message ? `${fallback}: ${error.message}` : fallback;
}

export const createProductionBatch = async (req, res) => {
  try {
    const { items, note } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, message: "items vazio." });
    }

    const rows = [];
    for (const it of items) {
      const product_id = String(it.product_id || "").trim();
      const qty = Number(it.qty);

      if (!product_id) continue;
      if (!Number.isFinite(qty) || qty <= 0) continue;

      rows.push({
        product_id,
        qty_delta: Math.trunc(qty),
        reason: "production",
        reference: (it.note || note || null),
        created_by: req.user?.id || null,
      });
    }

    if (rows.length === 0) {
      return res.status(400).json({ ok: false, message: "Nenhuma linha válida (qty > 0)." });
    }

    const { error } = await supabase
      .from("product_stock_movements")
      .insert(rows);

    if (error) throw error;

    return res.json({ ok: true, inserted: rows.length });
  } catch (e) {
    console.error("[createProductionBatch]", e?.message || e);
    return res.status(500).json({ ok: false, message: "Erro ao lançar produção." });
  }
};

export async function listIngredients(req, res) {
  try {
    const includeInactive = String(req.query.include_inactive || "false") === "true";
    let query = supabase
      .from("production_ingredients")
      .select("*, suppliers(name)")
      .order("name", { ascending: true });

    if (!includeInactive) query = query.eq("active", true);

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ ok: true, ingredients: data || [] });
  } catch (error) {
    console.error("[listIngredients]", error);
    return res.status(500).json({ ok: false, message: formatError(error, "Erro ao listar insumos") });
  }
}

export async function createIngredient(req, res) {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ ok: false, message: "Nome do insumo obrigatório." });

    const payload = {
      name,
      category: req.body?.category || null,
      unit_type: normalizeUnit(req.body?.unit_type),
      supplier_id: req.body?.supplier_id || null,
      current_stock: parseQuantity(req.body?.current_stock, 0),
      reorder_min_quantity: parseQuantity(req.body?.reorder_min_quantity, 0),
      notes: req.body?.notes || null,
      active: req.body?.active !== false
    };

    const { data, error } = await supabase
      .from("production_ingredients")
      .insert([payload])
      .select("*, suppliers(name)")
      .single();

    if (error) throw error;

    return res.status(201).json({ ok: true, ingredient: data });
  } catch (error) {
    console.error("[createIngredient]", error);
    return res.status(500).json({ ok: false, message: formatError(error, "Erro ao criar insumo") });
  }
}

export async function updateIngredient(req, res) {
  try {
    const { id } = req.params;
    const patch = { updated_at: new Date().toISOString() };

    if (typeof req.body?.name !== "undefined") {
      const name = String(req.body.name || "").trim();
      if (!name) return res.status(400).json({ ok: false, message: "Nome do insumo obrigatório." });
      patch.name = name;
    }

    if (typeof req.body?.category !== "undefined") patch.category = req.body.category || null;
    if (typeof req.body?.unit_type !== "undefined") patch.unit_type = normalizeUnit(req.body.unit_type);
    if (typeof req.body?.supplier_id !== "undefined") patch.supplier_id = req.body.supplier_id || null;
    if (typeof req.body?.current_stock !== "undefined") patch.current_stock = parseQuantity(req.body.current_stock, 0);
    if (typeof req.body?.reorder_min_quantity !== "undefined") patch.reorder_min_quantity = parseQuantity(req.body.reorder_min_quantity, 0);
    if (typeof req.body?.notes !== "undefined") patch.notes = req.body.notes || null;
    if (typeof req.body?.active !== "undefined") patch.active = !!req.body.active;

    const { data, error } = await supabase
      .from("production_ingredients")
      .update(patch)
      .eq("id", id)
      .select("*, suppliers(name)")
      .single();

    if (error) throw error;

    return res.json({ ok: true, ingredient: data });
  } catch (error) {
    console.error("[updateIngredient]", error);
    return res.status(500).json({ ok: false, message: formatError(error, "Erro ao atualizar insumo") });
  }
}

export async function archiveIngredient(req, res) {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("production_ingredients")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .single();

    if (error) throw error;

    return res.json({ ok: true, ingredient: data });
  } catch (error) {
    console.error("[archiveIngredient]", error);
    return res.status(500).json({ ok: false, message: formatError(error, "Erro ao arquivar insumo") });
  }
}

export async function listProductIngredients(req, res) {
  try {
    const { productId } = req.params;
    const { data, error } = await supabase
      .from("product_ingredient_requirements")
      .select("id, product_id, ingredient_id, quantity_per_unit, unit_type, notes, production_ingredients(id, name, category, unit_type, current_stock, supplier_id, suppliers(name))")
      .eq("product_id", productId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return res.json({ ok: true, items: data || [] });
  } catch (error) {
    console.error("[listProductIngredients]", error);
    return res.status(500).json({ ok: false, message: formatError(error, "Erro ao listar ficha técnica") });
  }
}

export async function replaceProductIngredients(req, res) {
  try {
    const { productId } = req.params;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const rows = [];
    const seen = new Set();

    for (const item of items) {
      const ingredientId = String(item.ingredient_id || "").trim();
      const quantity = parseQuantity(item.quantity_per_unit, 0);
      if (!ingredientId || !Number.isFinite(quantity) || quantity <= 0 || seen.has(ingredientId)) continue;
      seen.add(ingredientId);
      rows.push({
        product_id: productId,
        ingredient_id: ingredientId,
        quantity_per_unit: quantity,
        unit_type: item.unit_type ? normalizeUnit(item.unit_type) : null,
        notes: item.notes || null
      });
    }

    const { error: deleteError } = await supabase
      .from("product_ingredient_requirements")
      .delete()
      .eq("product_id", productId);

    if (deleteError) throw deleteError;

    if (rows.length) {
      const { error: insertError } = await supabase
        .from("product_ingredient_requirements")
        .insert(rows);
      if (insertError) throw insertError;
    }

    return listProductIngredients(req, res);
  } catch (error) {
    console.error("[replaceProductIngredients]", error);
    return res.status(500).json({ ok: false, message: formatError(error, "Erro ao salvar ficha técnica") });
  }
}

export async function generateShoppingList(req, res) {
  try {
    const productionItems = normalizeProductionItems(req.body?.items);
    const shouldSave = req.body?.save === true;
    const title = String(req.body?.title || "").trim() || null;

    if (!productionItems.length) {
      return res.status(400).json({ ok: false, message: "Selecione pelo menos um produto com quantidade maior que zero." });
    }

    const productIds = productionItems.map((item) => item.product_id);
    const quantityByProduct = new Map(productionItems.map((item) => [item.product_id, item.quantity]));

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name")
      .in("id", productIds);

    if (productsError) throw productsError;

    const productById = new Map((products || []).map((product) => [product.id, product]));

    const { data: requirements, error: requirementsError } = await supabase
      .from("product_ingredient_requirements")
      .select("product_id, ingredient_id, quantity_per_unit, unit_type, production_ingredients(id, name, category, unit_type, current_stock, supplier_id, suppliers(name))")
      .in("product_id", productIds);

    if (requirementsError) throw requirementsError;

    const requirementsByProduct = new Map();
    const listByKey = new Map();

    for (const requirement of requirements || []) {
      const productQty = quantityByProduct.get(requirement.product_id) || 0;
      const ingredient = requirement.production_ingredients || {};
      const unit = normalizeUnit(requirement.unit_type || ingredient.unit_type);
      const requiredQty = roundQuantity(Number(requirement.quantity_per_unit || 0) * productQty);
      const key = `${requirement.ingredient_id}:${unit}`;

      requirementsByProduct.set(
        requirement.product_id,
        (requirementsByProduct.get(requirement.product_id) || 0) + 1
      );

      if (!listByKey.has(key)) {
        listByKey.set(key, {
          ingredient_id: requirement.ingredient_id,
          item_name: ingredient.name || "Insumo",
          category: ingredient.category || null,
          unit_type: unit,
          supplier_id: ingredient.supplier_id || null,
          supplier_name: ingredient.suppliers?.name || null,
          current_stock: Number(ingredient.current_stock || 0),
          required_quantity: 0,
          purchase_quantity: 0,
          products: []
        });
      }

      const item = listByKey.get(key);
      item.required_quantity = roundQuantity(item.required_quantity + requiredQty);
      item.products.push({
        product_id: requirement.product_id,
        product_name: productById.get(requirement.product_id)?.name || requirement.product_id,
        planned_quantity: productQty,
        quantity_per_unit: Number(requirement.quantity_per_unit || 0),
        required_quantity: requiredQty
      });
    }

    const shoppingItems = [...listByKey.values()]
      .map((item) => ({
        ...item,
        purchase_quantity: roundQuantity(Math.max(item.required_quantity - item.current_stock, 0))
      }))
      .sort((a, b) => String(a.item_name).localeCompare(String(b.item_name), "pt-BR"));

    const missingRequirements = productionItems
      .filter((item) => !requirementsByProduct.has(item.product_id))
      .map((item) => ({
        product_id: item.product_id,
        product_name: productById.get(item.product_id)?.name || item.product_id,
        planned_quantity: item.quantity
      }));

    const responsePayload = {
      production_items: productionItems.map((item) => ({
        ...item,
        product_name: productById.get(item.product_id)?.name || item.product_id
      })),
      shopping_items: shoppingItems,
      missing_requirements: missingRequirements
    };

    if (shouldSave) {
      const { data: saved, error: saveError } = await supabase
        .from("production_shopping_lists")
        .insert([{
          title,
          production_items_json: responsePayload.production_items,
          shopping_items_json: responsePayload.shopping_items,
          missing_requirements_json: responsePayload.missing_requirements,
          created_by: req.user?.id || null
        }])
        .select("*")
        .single();

      if (saveError) throw saveError;
      responsePayload.saved_list = saved;
    }

    return res.json({ ok: true, ...responsePayload });
  } catch (error) {
    console.error("[generateShoppingList]", error);
    return res.status(500).json({ ok: false, message: formatError(error, "Erro ao gerar lista de compras") });
  }
}
