
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

    const title = `Pedido Tá na Mão!`;

    // MÁXIMA SIMPLIFICAÇÃO: Removido tudo que não é estritamente obrigatório
    // para evitar qualquer bloqueio do Mercado Pago.
    const preferenceBody = {
      items: [
        {
          id: "marmitas",
          title: title,
          quantity: 1,
          unit_price: order.total,
          currency_id: "BRL"
        }
      ],
      payer: {
        name: customer.nome,
        // Mercado Pago as vezes bloqueia se o formato do telefone for estranho, melhor passar só email fake ou nada
        email: "pix@tanamaofit.com.br"
      },
      external_reference: externalReference,
      back_urls: {
        success: env.frontendSuccessUrl,
        failure: env.frontendFailureUrl,
        pending: env.frontendSuccessUrl
      },
      auto_return: "approved",
      notification_url: req.protocol + "://" + req.get("host") + "/api/payments/webhook"
    };

    console.log("[MercadoPago] Criando preferência:", JSON.stringify(preferenceBody, null, 2));

    const response = await preferenceClient.create({ body: preferenceBody });

    console.log("[MercadoPago] Preferência criada. ID:", response.id);

    // Salva no banco com o endereço incluso (se houver)
    await createOrder({
      external_reference: externalReference,
      customer_name: customer.nome,
      customer_phone: customer.telefone,
      delivery_address: customer.endereco 
        ? `${customer.endereco.rua || ''}, ${customer.endereco.numero || ''} ${customer.endereco.complemento || ''} - ${customer.endereco.bairro || ''}. CEP: ${customer.endereco.cep || ''}`
        : null,
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
    console.error("[checkout:createPreference] Erro fatal:", error);

    // Adicionado log detalhado do erro do MP
    if(error.cause) console.error("Detalhes da causa:", error.cause);
    if(error.response) console.error("Resposta do MP:", error.response);

    return res.status(500).json({
      ok: false,
      message: "Erro ao criar preferência de pagamento.",
      error: error?.message || "unknown_error"
    });
  }
}
