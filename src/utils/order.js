import { PRODUCT_CATALOG } from "../catalog.js";

export function buildOrder(items, paymentMethod) {
  const detailedItems = items.map((item) => {
    const found = PRODUCT_CATALOG[item.id];
    if (!found) {
      throw new Error(`Produto inválido: ${item.id}`);
    }

    return {
      id: found.id,
      title: found.title,
      quantity: item.quantity,
      unit_price: found.unit_price,
      line_total: found.unit_price * item.quantity
    };
  });

  const subtotal = detailedItems.reduce((acc, item) => acc + item.line_total, 0);
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
