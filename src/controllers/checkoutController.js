import { preferenceClient } from "../config/mercadopago.js";
import { env } from "../config/env.js";
import { checkoutSchema } from "../validators/checkout.js";
import { buildExternalReference, buildOrderFromDatabase } from "../utils/order.js";
import { getProductsMapByIds } from "../services/productService.js";
import { createOrder } from "../services/orderService.js";
import { supabase } from "../config/supabase.js";

const PAYMENT_METHOD_LABELS = {
  pix: "Pix",
  debito: "Débito",
  credito: "Crédito",
  vale: "Vale Alimentação"
};

// ✅ FUNÇÃO AUXILIAR PARA URLs RESILIENTES
const getBaseUrl = () => {
  let url = env.frontendUrl;
  // Se o env estiver como "*" ou vazio, aponta para o domínio principal
  if (!url || url === "*") url = "https://www.tanamaofit.com.br";
  // Remove barra no final se existir para evitar links duplos //
  return url.replace(/\/$/, "");
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

    // ✅ 1. BUSCA LIMITE DE PEDIDOS (Tabela system_settings)
    const { data: limitData } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'orders_limit')
      .single();

    const limit = Number(limitData?.value || 999);
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
    const order = buildOrderFromDatabase(items, productsMap, paymentMethod);

    // ✅ 2. BUSCA TAXAS DINÂMICAS (Tabela system_settings)
    const { data: feeData } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "payment_fees")
      .single();

    const fees = feeData?.value || {};
    const feePercent = {
      pix: fees.pix || 0,
      debito: fees.debit_card || 0,
      credito: fees.credit_card || 0,
      vale: 0
    };

    const gatewayFee = Number((order.total * (feePercent[paymentMethod] || 0) / 100).toFixed(2));
    const netTotal = Number((order.total - gatewayFee).toFixed(2));

    const externalReference = buildExternalReference();
    const baseUrl = getBaseUrl();

    // ✅ 3. PAYLOAD MERCADO PAGO COM URLS DINÂMICAS
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
        email: "pix@tanamaofit.com.br"
      },
      external_reference: externalReference,
      back_urls: {
        success: `${baseUrl}/sucesso.html`,
        failure: `${baseUrl}/falha.html`,
        pending: `${baseUrl}/sucesso.html`
      },
      auto_return: "approved",
      // Webhook dinâmico baseado em onde o servidor está rodando
      notification_url: `${req.protocol}://${req.get("host")}/api/payments/webhook`
    };

    const response = await preferenceClient.create({ body: preferenceBody });

    // ✅ 4. SALVA NO BANCO
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
      gateway_fee: gatewayFee,
      net_total: netTotal,
      items_json: order.detailedItems,
      source: source || "site"
    });

    return res.status(201).json({
      ok: true,
      checkoutUrl: response.init_point,
      externalReference,
      order: {
        total: order.total,
        paymentMethod,
        items: order.detailedItems
      }
    });

  } catch (error) {
    console.error("[checkout:createPreference] Erro fatal:", error);
    return res.status(500).json({
      ok: false,
      message: "Erro ao processar seu pedido. Tente novamente."
    });
  }
}

