import { preferenceClient } from "../config/mercadopago.js";
import { env } from "../config/env.js";
import { checkoutSchema } from "../validators/checkout.js";
import { buildExternalReference, buildOrderFromDatabase } from "../utils/order.js";
import { getProductsMapByIds } from "../services/productService.js";
import { createOrder } from "../services/orderService.js";
import { supabase } from "../config/supabase.js";

const getBaseUrl = () => {
  let url = env.frontendUrl;
  if (!url || url === "*") url = "https://www.tanamaofit.com.br";
  return url.replace(/\/$/, "");
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const BUSINESS_ERROR_PATTERNS = [
  "Produto ",
  "Estoque ",
  "indisponível",
  "antecedência",
  "Limite de produção"
];

function isBusinessError(error) {
  return BUSINESS_ERROR_PATTERNS.some((pattern) => error?.message?.includes(pattern));
}

async function getSettingsValue(key, fallback = {}) {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.warn(`[checkout:settings] Falha ao carregar ${key}:`, error.message);
    return fallback;
  }

  return data?.value || fallback;
}

async function ensureScheduledCapacity({ items, productsMap, fulfillment }) {
  if (!fulfillment?.scheduledDate) return;

  const scheduledDate = fulfillment.scheduledDate;
  const scheduledAt = new Date(`${scheduledDate}T12:00:00`);
  const now = new Date();
  const weekday = WEEKDAYS[scheduledAt.getDay()];
  const ids = items.map((item) => item.id);

  for (const item of items) {
    const product = productsMap.get(item.id);
    const availableDays = Array.isArray(product?.available_days) ? product.available_days : [];
    if (availableDays.length && !availableDays.includes(weekday)) {
      throw new Error(`Produto indisponível para a data escolhida: ${product.name}`);
    }

    const leadTimeHours = Number(product?.lead_time_hours || 0);
    if (leadTimeHours > 0) {
      const minimumDate = new Date(now.getTime() + leadTimeHours * 60 * 60 * 1000);
      if (scheduledAt < minimumDate) {
        throw new Error(`O produto ${product.name} exige ${leadTimeHours}h de antecedência.`);
      }
    }
  }

  const { data: capacities, error: capacityError } = await supabase
    .from("product_daily_capacities")
    .select("product_id, max_units")
    .eq("production_date", scheduledDate)
    .in("product_id", ids);

  if (capacityError) throw capacityError;

  const capacityMap = new Map((capacities || []).map((row) => [row.product_id, row.max_units]));

  const { data: scheduledOrders, error: ordersError } = await supabase
    .from("orders")
    .select("items_json")
    .eq("scheduled_delivery_date", scheduledDate)
    .in("payment_status", ["pending", "approved"]);

  if (ordersError) throw ordersError;

  const reservedByProduct = new Map();
  for (const order of scheduledOrders || []) {
    for (const orderItem of order.items_json || []) {
      const current = reservedByProduct.get(orderItem.id) || 0;
      reservedByProduct.set(orderItem.id, current + Number(orderItem.quantity || 0));
    }
  }

  for (const item of items) {
    const product = productsMap.get(item.id);
    const limit = Number(capacityMap.get(item.id) ?? product?.max_units_per_day ?? 0);
    if (!limit) continue;

    const reserved = reservedByProduct.get(item.id) || 0;
    if (reserved + item.quantity > limit) {
      throw new Error(`Limite de produção atingido para ${product.name} nesta data.`);
    }
  }
}

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

    const { items, paymentMethod, customer, fulfillment, source } = parsed.data;

    const limitConfig = await getSettingsValue("order_limits", {});
    const cartDiscountConfig = await getSettingsValue("cart_discounts", {});
    const limit = Number(limitConfig?.max_per_day || 999);
    const hoje = new Date().toISOString().slice(0, 10);

    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', hoje)
      .eq('payment_status', 'approved');

    if (count >= limit) {
      return res.status(400).json({
        ok: false,
        message: "Desculpe, atingimos nosso limite de produção para hoje."
      });
    }

    const ids = items.map((item) => item.id);
    const productsMap = await getProductsMapByIds(ids);
    const order = buildOrderFromDatabase(items, productsMap, paymentMethod, cartDiscountConfig);
    await ensureScheduledCapacity({ items, productsMap, fulfillment });

    // 2. BUSCA TAXAS DINÂMICAS
    const { data: feeConfig } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "gateway_fees")
      .single();

    const fees = feeConfig?.value || {};
    const feePercent = {
      mercadopago: fees.mercadopago || 0,
      pix: fees.pix || 0,
      debito: fees.debit_card || 0,
      credito: fees.credit_card || 0
    };

    const gatewayFee = Number((order.total * (feePercent[paymentMethod] || 0) / 100).toFixed(2));
    const netTotal = Number((order.total - gatewayFee).toFixed(2));

    const externalReference = buildExternalReference();
    const baseUrl = getBaseUrl();

    const preferenceBody = {
      items: [
        {
          id: "marmitas",
          title: "Pedido Tá na Mão!",
          quantity: 1,
          unit_price: order.total,
          currency_id: "BRL"
        }
      ],
      payer: {
        name: customer.nome,
        email: "pagamento@tanamaofit.com.br"
      },
      external_reference: externalReference,
      back_urls: {
        success: `${baseUrl}/sucesso.html`,
        failure: `${baseUrl}/falha.html`,
        pending: `${baseUrl}/sucesso.html`
      },
      auto_return: "approved",
      notification_url: `${env.backendUrl}/api/payments/webhook`,
      additional_info: {
        items: order.detailedItems.map((item) => ({
          id: item.id,
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unit_price
        }))
      }
    };

    const response = await preferenceClient.create({ body: preferenceBody });

    const orderPayload = {
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
      gateway_fee: gatewayFee,
      net_total: netTotal,
      items_json: order.detailedItems,
      weekly_context_report: order.weeklyContextReport,
      source: source || "site"
    };

    if (fulfillment?.scheduledDate) {
      orderPayload.scheduled_delivery_date = fulfillment.scheduledDate;
    }

    if (fulfillment?.deliveryWindow) {
      orderPayload.delivery_window = fulfillment.deliveryWindow;
    }

    if (fulfillment?.type) {
      orderPayload.fulfillment_type = fulfillment.type;
    }

    await createOrder(orderPayload);

    return res.status(201).json({
      ok: true,
      checkoutUrl: response.init_point,
      externalReference,
      order: {
        total: order.total,
        paymentMethod,
        fulfillment: fulfillment || null,
        items: order.detailedItems,
        weeklyContextReport: order.weeklyContextReport
      }
    });

  } catch (error) {
    console.error("[checkout:createPreference] Erro fatal:", error);
    if (isBusinessError(error)) {
      return res.status(400).json({
        ok: false,
        message: error.message
      });
    }

    return res.status(500).json({
      ok: false,
      message: "Erro ao processar seu pedido."
    });
  }
}
