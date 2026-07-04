// src/utils/order.js

const USAGE_CONTEXT_DEFINITIONS = [
  {
    id: "breakfast",
    label: "Café da manhã",
    complement: "Inclua opções simples para começar o dia com saciedade, como frutas, ovos, iogurte natural, aveia ou pães integrais."
  },
  {
    id: "work",
    label: "Para levar para o trabalho",
    complement: "Separe preparações fáceis de transportar e lanches estáveis para trabalho, estudo ou dias fora de casa."
  },
  {
    id: "lunch_dinner",
    label: "Almoço ou jantar",
    complement: "Garanta bases de refeição principal com proteína, legumes, verduras e acompanhamentos simples."
  },
  {
    id: "quick_snack",
    label: "Lanches rápidos",
    complement: "Tenha itens de preparo rápido para horários corridos, como frutas, castanhas, iogurte, ovos cozidos ou receitas simples."
  }
];

const DEFAULT_CART_DISCOUNT_CONFIG = {
  enabled: true,
  quantity_tiers: [
    { min_items: 3, rate: 0.03 },
    { min_items: 5, rate: 0.06 },
    { min_items: 8, rate: 0.09 },
    { min_items: 12, rate: 0.12 }
  ],
  diversity_tiers: [
    { min_unique_items: 3, rate: 0.01 },
    { min_unique_items: 5, rate: 0.02 }
  ],
  max_discount_rate: 0.15
};

function normalizeUsageContexts(value) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(USAGE_CONTEXT_DEFINITIONS.map((item) => item.id));
  return [...new Set(value.map((item) => String(item || "").trim()).filter((item) => allowed.has(item)))];
}

function normalizeRate(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed > 1 ? parsed / 100 : parsed;
}

function normalizeDiscountTiers(value, minKey) {
  if (!Array.isArray(value)) return [];
  return value
    .map((tier) => ({
      min: Math.max(0, Math.trunc(Number(tier?.[minKey] || tier?.min || 0))),
      rate: normalizeRate(tier?.rate, 0)
    }))
    .filter((tier) => tier.min > 0 && tier.rate > 0)
    .sort((a, b) => a.min - b.min);
}

function getTierRate(count, tiers) {
  return tiers.reduce((rate, tier) => (count >= tier.min ? tier.rate : rate), 0);
}

export function calculateCartDiscount(detailedItems, config = {}) {
  const finalConfig = {
    ...DEFAULT_CART_DISCOUNT_CONFIG,
    ...(config || {})
  };

  const totalItems = (detailedItems || []).reduce((acc, item) => acc + Number(item.quantity || 0), 0);
  const uniqueItems = new Set((detailedItems || []).filter((item) => Number(item.quantity || 0) > 0).map((item) => item.id)).size;
  const maxDiscountRate = normalizeRate(finalConfig.max_discount_rate, DEFAULT_CART_DISCOUNT_CONFIG.max_discount_rate);

  if (finalConfig.enabled === false || totalItems <= 0) {
    return {
      total_items: totalItems,
      unique_items: uniqueItems,
      quantity_rate: 0,
      diversity_rate: 0,
      discount_rate: 0,
      max_discount_rate: maxDiscountRate,
      capped: false
    };
  }

  const quantityRate = getTierRate(totalItems, normalizeDiscountTiers(finalConfig.quantity_tiers, "min_items"));
  const diversityRate = getTierRate(uniqueItems, normalizeDiscountTiers(finalConfig.diversity_tiers, "min_unique_items"));
  const rawRate = quantityRate + diversityRate;
  const discountRate = Number(Math.min(rawRate, maxDiscountRate).toFixed(4));

  return {
    total_items: totalItems,
    unique_items: uniqueItems,
    quantity_rate: Number(quantityRate.toFixed(4)),
    diversity_rate: Number(diversityRate.toFixed(4)),
    discount_rate: discountRate,
    max_discount_rate: maxDiscountRate,
    capped: rawRate > discountRate
  };
}

export function buildWeeklyContextReport(detailedItems) {
  const covered = new Map(USAGE_CONTEXT_DEFINITIONS.map((item) => [item.id, []]));

  for (const item of detailedItems || []) {
    for (const context of normalizeUsageContexts(item.usage_contexts)) {
      covered.get(context)?.push({
        product_id: item.id,
        title: item.title,
        quantity: item.quantity
      });
    }
  }

  const contexts = USAGE_CONTEXT_DEFINITIONS.map((definition) => {
    const products = covered.get(definition.id) || [];
    return {
      id: definition.id,
      label: definition.label,
      covered: products.length > 0,
      products,
      complement: products.length ? null : definition.complement
    };
  });

  return {
    generated_at: new Date().toISOString(),
    version: "1.0",
    contexts,
    covered_contexts: contexts.filter((context) => context.covered).map((context) => context.id),
    missing_contexts: contexts.filter((context) => !context.covered).map((context) => context.id),
    shopping_suggestions: contexts
      .filter((context) => !context.covered)
      .map((context) => ({
        context: context.id,
        label: context.label,
        suggestion: context.complement
      }))
  };
}

/**
 * Constrói o objeto de pedido com base nos dados do banco e configurações.
 * @param {Array} items - Itens vindos do frontend [{id, quantity}]
 * @param {Map} productsMap - Map de produtos vindos do Supabase
 * @param {Object} config - Objeto contendo taxas e descontos (ex: vindo da tabela settings)
 */
export function buildOrderFromDatabase(items, productsMap, paymentMethod, config = {}) {
  const detailedItems = items.map((item) => {
    const found = productsMap.get(item.id);
    if (!found) {
      throw new Error(`Produto inválido ou inativo: ${item.id}`);
    }

    // Verificação de estoque antes mesmo de criar o pedido
    if (found.stock_quantity < item.quantity) {
      throw new Error(`Estoque insuficiente para o produto: ${found.name}`);
    }

    const unitPrice = Number(found.price);
    return {
      id: found.id,
      title: found.name,
      description: found.description,
      quantity: item.quantity,
      unit_price: unitPrice,
      line_total: Number((unitPrice * item.quantity).toFixed(2)),
      usage_contexts: normalizeUsageContexts(found.usage_contexts),
      weekly_guide_note: found.weekly_guide_note || null
    };
  });

  const weeklyContextReport = buildWeeklyContextReport(detailedItems);

  const subtotal = Number(detailedItems.reduce((acc, item) => acc + item.line_total, 0).toFixed(2));
  const discountBreakdown = calculateCartDiscount(detailedItems, config);
  const discountRate = discountBreakdown.discount_rate;
  const discount = Number((subtotal * discountRate).toFixed(2));
  const total = Number((subtotal - discount).toFixed(2));

  return {
    detailedItems,
    subtotal,
    discountRate,
    discount,
    total,
    discountBreakdown,
    weeklyContextReport,
    metadata: {
      generated_at: new Date().toISOString(),
      version: "3.0"
    }
  };
}

export function buildExternalReference() {
  // Referência única para o Mercado Pago e para o seu Banco de Dados
  return `TNM-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
