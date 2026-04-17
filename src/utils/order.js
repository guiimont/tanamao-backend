// src/utils/order.js

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
      line_total: Number((unitPrice * item.quantity).toFixed(2))
    };
  });

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
