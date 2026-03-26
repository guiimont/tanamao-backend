import { preferenceClient } from "../config/mercadopago.js";
import { env } from "../config/env.js";
import { checkoutSchema } from "../validators/checkout.js";
import { buildExternalReference, buildOrderFromDatabase } from "../utils/order.js";
import { getProductsMapByIds } from "../services/productService.js";
import { createOrder } from "../services/orderService.js";

const PAYMENT_METHOD_LABELS = {
  pix: "Pix",
  debito: "Débito",
  credito: "Crédito",
  vale: "Vale Alimentação"
};

export async function createPreference(req, res) {
  try {
    const parsed = checkoutSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        message: "Dados inválidos para checkout.",
        errors: parsed.error.flatten()
      });
    }

    const { items, paymentMethod, customer, source } = parsed.data;
    const ids = items.map((item) => item.id);
    const productsMap = await getProductsMapByIds(ids);
    const order = buildOrderFromDatabase(items, productsMap, paymentMethod);
    const externalReference = buildExternalReference();

    const title = `Pedido Tá na Mão! - ${PAYMENT_METHOD_LABELS[paymentMethod]}`;

    const preferenceBody = {
      items: [
        {
          id: externalReference,
          title,
          quantity: 1,
          unit_price: order.total,
          currency_id: "BRL",
          description: order.detailedItems.map((item) => `${item.title} x${item.quantity}`).join(", ")
        }
      ],
      payer: {
        name: customer.nome,
        phone: { number: customer.telefone }
      },
      external_reference: externalReference,
      statement_descriptor: "TANAMAO",
      back_urls: {
        success: env.frontendSuccessUrl,
        failure: env.frontendFailureUrl,
        pending: env.frontendSuccessUrl
      },
      auto_return: "approved",
      metadata: {
        brand: "Tá na Mão!",
        source,
        paymentMethod,
        customer,
        subtotal: order.subtotal,
        discount: order.discount,
        total: order.total,
        items: order.detailedItems
      },
      notification_url: req.protocol + "://" + req.get("host") + "/api/payments/webhook"
    };

    const response = await preferenceClient.create({ body: preferenceBody });

    await createOrder({
      external_reference: externalReference,
      customer_name: customer.nome,
      customer_phone: customer.telefone,
      customer_age: customer.idade ? String(customer.idade) : null,
      customer_profession: customer.profissao || null,
      customer_married: customer.casado || false,
      customer_has_children: customer.filhos || false,
      payment_method: paymentMethod,
      payment_status: "pending",
      mp_preference_id: response.id || null,
      subtotal: order.subtotal,
      discount: order.discount,
      total: order.total,
      items_json: order.detailedItems,
      source: source || "site"
    });

    return res.status(201).json({
      ok: true,
      checkoutUrl: response.init_point,
      sandboxCheckoutUrl: response.sandbox_init_point,
      externalReference,
      order: {
        subtotal: order.subtotal,
        discount: order.discount,
        total: order.total,
        paymentMethod,
        items: order.detailedItems
      }
    });
  } catch (error) {
    console.error("[checkout:createPreference]", error);
    return res.status(500).json({
      ok: false,
      message: "Erro ao criar preferência de pagamento.",
      error: error?.message || "unknown_error"
    });
  }
}
