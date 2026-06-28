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

function normalizeUsageContexts(value) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(USAGE_CONTEXT_DEFINITIONS.map((item) => item.id));
  return [...new Set(value.map((item) => String(item || "").trim()).filter((item) => allowed.has(item)))];
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
  // 1. Definição de taxas e descontos (Fallback para os valores atuais se a config falhar)
  const pixDiscount = config.pix_discount ?? 0.10; // 10%
  const cardFee = config.card_fee ?? 0; // Taxa extra para cartão se houver

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
  
  // 2. Aplicação da Regra de Desconto Unificada
  const isCashPayment = paymentMethod === "pix" || paymentMethod === "debito";
  const discountRate = isCashPayment ? pixDiscount : 0;
  
  const discount = Number((subtotal * discountRate).toFixed(2));
  const total = Number((subtotal - discount).toFixed(2));

  return {
    detailedItems,
    subtotal,
    discountRate,
    discount,
    total,
    weeklyContextReport,
    metadata: {
      generated_at: new Date().toISOString(),
      version: "2.0"
    }
  };
}

export function buildExternalReference() {
  // Referência única para o Mercado Pago e para o seu Banco de Dados
  return `TNM-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
