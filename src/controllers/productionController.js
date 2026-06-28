import { supabase } from "../config/supabase.js";

function parseQuantity(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(typeof value === "string" ? value.replace(",", ".") : value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeUnit(value, fallback = "un") {
  const aliases = {
    grama: "g",
    gramas: "g",
    g: "g",
    kg: "kg",
    kilo: "kg",
    kilos: "kg",
    quilo: "kg",
    quilos: "kg",
    ml: "ml",
    l: "l",
    litro: "l",
    litros: "l",
    unidade: "un",
    unidades: "un",
    und: "un",
    un: "un",
    pacote: "pct",
    pacotes: "pct",
    pct: "pct"
  };
  const unit = String(value || "").trim().toLowerCase();
  return aliases[unit] || unit || fallback;
}

function getUnitDefinition(unit) {
  const normalized = normalizeUnit(unit);
  const definitions = {
    g: { group: "mass", factor: 1 },
    kg: { group: "mass", factor: 1000 },
    ml: { group: "volume", factor: 1 },
    l: { group: "volume", factor: 1000 },
    un: { group: "count", factor: 1 },
    pct: { group: "package", factor: 1 }
  };
  return definitions[normalized] ? { unit: normalized, ...definitions[normalized] } : null;
}

function convertQuantity(value, fromUnit, toUnit) {
  const source = getUnitDefinition(fromUnit);
  const target = getUnitDefinition(toUnit);
  const quantity = Number(value || 0);

  if (normalizeUnit(fromUnit) === normalizeUnit(toUnit)) return { quantity, converted: false };
  if (!source || !target || source.group !== target.group) {
    return { quantity, converted: false, warning: true };
  }

  return {
    quantity: quantity * source.factor / target.factor,
    converted: true
  };
}

function unitsAreCompatible(fromUnit, toUnit) {
  if (normalizeUnit(fromUnit) === normalizeUnit(toUnit)) return true;
  const source = getUnitDefinition(fromUnit);
  const target = getUnitDefinition(toUnit);
  return !!source && !!target && source.group === target.group;
}

function normalizeIngredientName(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeIngredientRows(rows = []) {
  return (rows || []).filter(Boolean).map((row) => {
    if (row?.production_ingredients) {
      row.production_ingredients.unit_type = normalizeUnit(row.production_ingredients.unit_type);
    }
    if (row?.unit_type) row.unit_type = normalizeUnit(row.unit_type);
    if (row?.unit_type === "") row.unit_type = null;
    if (typeof row.unit_type === "undefined") row.unit_type = null;
    return row;
  });
}

function selectIngredientWithSupplier() {
  return "*, suppliers(name)";
}

async function findIngredientByName(name) {
  const normalized = normalizeIngredientName(name);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("production_ingredients")
    .select(selectIngredientWithSupplier());

  if (error) throw error;
  return (data || []).find((item) => normalizeIngredientName(item.name) === normalized) || null;
}

function validateNonNegative(value, fieldName) {
  if (!Number.isFinite(value) || value < 0) {
    const error = new Error(`${fieldName} deve ser maior ou igual a zero.`);
    error.statusCode = 400;
    throw error;
  }
  return value;
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
      .select(selectIngredientWithSupplier())
      .order("name", { ascending: true });

    if (!includeInactive) query = query.eq("active", true);

    const { data, error } = await query;
    if (error) throw error;

    const ingredients = (data || []).map((item) => ({
      ...item,
      unit_type: normalizeUnit(item.unit_type)
    }));

    return res.json({ ok: true, ingredients });
  } catch (error) {
    console.error("[listIngredients]", error);
    return res.status(error.statusCode || 500).json({ ok: false, message: formatError(error, "Erro ao listar insumos") });
  }
}

export async function createIngredient(req, res) {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ ok: false, message: "Nome do insumo obrigatório." });

    const currentStock = validateNonNegative(parseQuantity(req.body?.current_stock, 0), "Estoque atual");
    const reorderMinQuantity = validateNonNegative(parseQuantity(req.body?.reorder_min_quantity, 0), "Estoque mínimo");
    const existing = await findIngredientByName(name);

    if (existing) {
      if (existing.active !== false) {
        return res.json({
          ok: true,
          created: false,
          ingredient: { ...existing, unit_type: normalizeUnit(existing.unit_type) }
        });
      }

      const { data, error } = await supabase
        .from("production_ingredients")
        .update({ active: true, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select(selectIngredientWithSupplier())
        .single();

      if (error) throw error;

      return res.json({
        ok: true,
        created: false,
        ingredient: { ...data, unit_type: normalizeUnit(data.unit_type) }
      });
    }

    const payload = {
      name,
      category: req.body?.category || null,
      unit_type: normalizeUnit(req.body?.unit_type),
      supplier_id: req.body?.supplier_id || null,
      current_stock: currentStock,
      reorder_min_quantity: reorderMinQuantity,
      notes: req.body?.notes || null,
      active: req.body?.active !== false
    };

    const { data, error } = await supabase
      .from("production_ingredients")
      .insert([payload])
      .select(selectIngredientWithSupplier())
      .single();

    if (error) throw error;

    return res.status(201).json({ ok: true, created: true, ingredient: { ...data, unit_type: normalizeUnit(data.unit_type) } });
  } catch (error) {
    console.error("[createIngredient]", error);
    return res.status(error.statusCode || 500).json({ ok: false, message: formatError(error, "Erro ao criar insumo") });
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
    if (typeof req.body?.current_stock !== "undefined") patch.current_stock = validateNonNegative(parseQuantity(req.body.current_stock, 0), "Estoque atual");
    if (typeof req.body?.reorder_min_quantity !== "undefined") patch.reorder_min_quantity = validateNonNegative(parseQuantity(req.body.reorder_min_quantity, 0), "Estoque mínimo");
    if (typeof req.body?.notes !== "undefined") patch.notes = req.body.notes || null;
    if (typeof req.body?.active !== "undefined") patch.active = !!req.body.active;

    const { data, error } = await supabase
      .from("production_ingredients")
      .update(patch)
      .eq("id", id)
      .select(selectIngredientWithSupplier())
      .single();

    if (error) throw error;

    return res.json({ ok: true, ingredient: { ...data, unit_type: normalizeUnit(data.unit_type) } });
  } catch (error) {
    console.error("[updateIngredient]", error);
    return res.status(error.statusCode || 500).json({ ok: false, message: formatError(error, "Erro ao atualizar insumo") });
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

    return res.json({ ok: true, items: normalizeIngredientRows(data || []) });
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
      const stockUnit = normalizeUnit(ingredient.unit_type);
      const recipeUnit = normalizeUnit(requirement.unit_type || stockUnit);
      const sourceRequiredQty = roundQuantity(Number(requirement.quantity_per_unit || 0) * productQty);
      const compatibleUnits = unitsAreCompatible(recipeUnit, stockUnit);
      const converted = convertQuantity(sourceRequiredQty, recipeUnit, stockUnit);
      const outputUnit = compatibleUnits ? stockUnit : recipeUnit;
      const requiredQty = roundQuantity(compatibleUnits ? converted.quantity : sourceRequiredQty);
      const key = `${requirement.ingredient_id}:${outputUnit}`;

      requirementsByProduct.set(
        requirement.product_id,
        (requirementsByProduct.get(requirement.product_id) || 0) + 1
      );

      if (!listByKey.has(key)) {
        listByKey.set(key, {
          ingredient_id: requirement.ingredient_id,
          item_name: ingredient.name || "Insumo",
          category: ingredient.category || null,
          unit_type: outputUnit,
          stock_unit_type: stockUnit,
          supplier_id: ingredient.supplier_id || null,
          supplier_name: ingredient.suppliers?.name || null,
          current_stock: compatibleUnits ? Number(ingredient.current_stock || 0) : 0,
          required_quantity: 0,
          purchase_quantity: 0,
          conversion_warning: !compatibleUnits,
          products: []
        });
      }

      const item = listByKey.get(key);
      item.required_quantity = roundQuantity(item.required_quantity + requiredQty);
      item.conversion_warning = item.conversion_warning || !compatibleUnits;
      item.products.push({
        product_id: requirement.product_id,
        product_name: productById.get(requirement.product_id)?.name || requirement.product_id,
        planned_quantity: productQty,
        quantity_per_unit: Number(requirement.quantity_per_unit || 0),
        unit_type: recipeUnit,
        source_required_quantity: sourceRequiredQty,
        source_unit_type: recipeUnit,
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
