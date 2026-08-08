import { supabase } from "../config/supabase.js";

const TERMINAL_ORDER_STATUSES = new Set(["delivered", "canceled"]);

function round(value) {
  return Number(Number(value || 0).toFixed(4));
}

function normalizeUnit(value, fallback = "un") {
  const aliases = {
    grama: "g", gramas: "g", g: "g",
    kg: "kg", kilo: "kg", kilos: "kg", quilo: "kg", quilos: "kg",
    ml: "ml", l: "l", litro: "l", litros: "l",
    unidade: "un", unidades: "un", und: "un", un: "un",
    pacote: "pct", pacotes: "pct", pct: "pct"
  };
  const unit = String(value || "").trim().toLowerCase();
  return aliases[unit] || unit || fallback;
}

function unitDefinition(value) {
  const unit = normalizeUnit(value);
  return {
    g: { group: "mass", factor: 1 },
    kg: { group: "mass", factor: 1000 },
    ml: { group: "volume", factor: 1 },
    l: { group: "volume", factor: 1000 },
    un: { group: "count", factor: 1 },
    pct: { group: "package", factor: 1 }
  }[unit] || null;
}

function convert(value, fromUnit, toUnit) {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return { quantity: round(value), compatible: true };
  const source = unitDefinition(from);
  const target = unitDefinition(to);
  if (!source || !target || source.group !== target.group) {
    return { quantity: round(value), compatible: false };
  }
  return { quantity: round(Number(value) * source.factor / target.factor), compatible: true };
}

function normalizeOrderItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    product_id: String(item.id || item.product_id || "").trim(),
    product_name: String(item.title || item.product_name || item.name || "Produto"),
    quantity: Number(item.quantity || item.qty || 0)
  })).filter((item) => item.product_id && Number.isFinite(item.quantity) && item.quantity > 0);
}

export async function buildProductionRoundPlan({ orderCutoffAt, deliveryDate, safetyMarginPercent = 0, excludeRoundId = null }) {
  let assignedQuery = supabase.from("production_round_orders").select("order_id");
  if (excludeRoundId) assignedQuery = assignedQuery.neq("production_round_id", excludeRoundId);
  const { data: assignedRows, error: assignedError } = await assignedQuery;
  if (assignedError) throw assignedError;
  const assignedIds = new Set((assignedRows || []).map((row) => String(row.order_id)));

  let ordersQuery = supabase
    .from("orders")
    .select("id, external_reference, customer_name, delivery_status, scheduled_delivery_date, fulfillment_type, items_json, total")
    .eq("payment_status", "approved")
    .lte("created_at", orderCutoffAt)
    .order("created_at", { ascending: true });
  if (deliveryDate) ordersQuery = ordersQuery.eq("scheduled_delivery_date", deliveryDate);

  const { data: allOrders, error: ordersError } = await ordersQuery;
  if (ordersError) throw ordersError;
  const orders = (allOrders || []).filter((order) =>
    !assignedIds.has(String(order.id)) && !TERMINAL_ORDER_STATUSES.has(order.delivery_status)
  );

  const demandByProduct = new Map();
  for (const order of orders) {
    for (const item of normalizeOrderItems(order.items_json)) {
      const current = demandByProduct.get(item.product_id) || {
        product_id: item.product_id,
        product_name: item.product_name,
        ordered_quantity: 0
      };
      current.ordered_quantity = round(current.ordered_quantity + item.quantity);
      demandByProduct.set(item.product_id, current);
    }
  }

  const marginMultiplier = 1 + Number(safetyMarginPercent || 0) / 100;
  const productIds = [...demandByProduct.keys()];
  const { data: products, error: productsError } = productIds.length
    ? await supabase.from("products").select("id, name, stock_quantity").in("id", productIds)
    : { data: [], error: null };
  if (productsError) throw productsError;
  const productMap = new Map((products || []).map((product) => [String(product.id), product]));

  const demand = [...demandByProduct.values()].map((item) => {
    const product = productMap.get(item.product_id);
    const readyStock = Math.max(Number(product?.stock_quantity || 0), 0);
    const targetQuantity = Math.ceil(item.ordered_quantity * marginMultiplier);
    return {
      ...item,
      product_name: product?.name || item.product_name,
      safety_margin_quantity: round(targetQuantity - item.ordered_quantity),
      ready_stock_quantity: readyStock,
      planned_quantity: Math.max(targetQuantity - readyStock, 0)
    };
  }).sort((a, b) => a.product_name.localeCompare(b.product_name, "pt-BR"));

  const { data: requirements, error: requirementsError } = productIds.length
    ? await supabase
      .from("product_ingredient_requirements")
      .select("product_id, ingredient_id, quantity_per_unit, unit_type, production_ingredients(id, name, category, unit_type, current_stock, supplier_id)")
      .in("product_id", productIds)
    : { data: [], error: null };
  if (requirementsError) throw requirementsError;

  const requirementsByProduct = new Set();
  const shoppingByIngredient = new Map();
  const plannedByProduct = new Map(demand.map((item) => [item.product_id, item.planned_quantity]));

  for (const requirement of requirements || []) {
    const plannedQuantity = plannedByProduct.get(String(requirement.product_id)) || 0;
    if (plannedQuantity <= 0) continue;
    requirementsByProduct.add(String(requirement.product_id));
    const ingredient = requirement.production_ingredients;
    if (!ingredient) continue;
    const stockUnit = normalizeUnit(ingredient.unit_type);
    const recipeUnit = normalizeUnit(requirement.unit_type || stockUnit);
    const converted = convert(Number(requirement.quantity_per_unit || 0) * plannedQuantity, recipeUnit, stockUnit);
    const outputUnit = converted.compatible ? stockUnit : recipeUnit;
    const key = `${ingredient.id}:${outputUnit}`;
    const current = shoppingByIngredient.get(key) || {
      ingredient_id: ingredient.id,
      item_name: ingredient.name,
      category: ingredient.category || null,
      supplier_id: ingredient.supplier_id || null,
      unit_type: outputUnit,
      current_stock: converted.compatible ? Number(ingredient.current_stock || 0) : 0,
      required_quantity: 0,
      conversion_warning: !converted.compatible,
      products: []
    };
    current.required_quantity = round(current.required_quantity + converted.quantity);
    current.conversion_warning ||= !converted.compatible;
    current.products.push({
      product_id: requirement.product_id,
      product_name: productMap.get(String(requirement.product_id))?.name || requirement.product_id,
      planned_quantity: plannedQuantity,
      quantity_per_unit: Number(requirement.quantity_per_unit || 0),
      recipe_unit_type: recipeUnit
    });
    shoppingByIngredient.set(key, current);
  }

  const shopping = [...shoppingByIngredient.values()].map((item) => ({
    ...item,
    purchase_quantity: round(Math.max(item.required_quantity - item.current_stock, 0))
  })).sort((a, b) => a.item_name.localeCompare(b.item_name, "pt-BR"));

  const missingRequirements = demand.filter((item) =>
    item.planned_quantity > 0 && !requirementsByProduct.has(item.product_id)
  ).map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name,
    planned_quantity: item.planned_quantity
  }));

  return {
    orders,
    demand,
    shopping,
    missing_requirements: missingRequirements,
    summary: {
      order_count: orders.length,
      product_count: demand.length,
      ordered_units: round(demand.reduce((sum, item) => sum + item.ordered_quantity, 0)),
      planned_units: round(demand.reduce((sum, item) => sum + item.planned_quantity, 0)),
      purchase_item_count: shopping.filter((item) => item.purchase_quantity > 0).length,
      missing_requirement_count: missingRequirements.length,
      delivery_count: orders.filter((order) => order.fulfillment_type !== "pickup").length,
      pickup_count: orders.filter((order) => order.fulfillment_type === "pickup").length
    }
  };
}
