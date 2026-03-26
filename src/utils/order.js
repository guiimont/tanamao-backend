export function buildOrderFromDatabase(items, productsMap, paymentMethod) {
  const detailedItems = items.map((item) => {
    const found = productsMap.get(item.id);
    if (!found) {
      throw new Error(`Produto inválido ou inativo: ${item.id}`);
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
  const discountRate = paymentMethod === "pix" || paymentMethod === "debito" ? 0.1 : 0;
  const discount = Number((subtotal * discountRate).toFixed(2));
  const total = Number((subtotal - discount).toFixed(2));

  return {
    detailedItems,
    subtotal,
    discountRate,
    discount,
    total
  };
}

export function buildExternalReference() {
  return `TNM-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
