import crypto from "crypto";
import { paymentClient } from "../config/mercadopago.js";
import { supabase } from "../config/supabase.js";
import { env } from "../config/env.js";

export const paymentWebhook = async (req, res) => {
  const { query, body, headers } = req;
  
  // 1. Resposta rápida ao Mercado Pago
  res.status(200).send("OK");

  try {
    const paymentId = query["data.id"] || body?.data?.id;
    if (!paymentId) return;

    // 2. Validação de Autenticidade
    if (env.webhookSecret) {
      const signatureHeader = headers["x-signature"];
      if (!signatureHeader) return;

      const parts = signatureHeader.split(",");
      const ts = parts.find(p => p.startsWith("ts="))?.split("=")[1];
      const v1 = parts.find(p => p.startsWith("v1="))?.split("=")[1];
      const manifest = `id:${paymentId};request-id:;ts:${ts};`;
      const hash = crypto.createHmac("sha256", env.webhookSecret).update(manifest).digest("hex");

      if (hash !== v1) return;
    }

    // 3. Buscar detalhes oficiais do pagamento no Mercado Pago
    const payment = await paymentClient.get({ id: paymentId });

    if (payment.status !== "approved") {
      console.info(`[Webhook] Pagamento ${paymentId} ignorado (Status: ${payment.status})`);
      return;
    }

    // 4. A "Mágica" acontece aqui:
    // Enviamos o ID do pagamento, o ID do pedido e a lista de itens.
    // O Supabase cuida da idempotência, do estoque e do status da venda.
    const { error: rpcError } = await supabase.rpc("process_order_stock", {
      p_payment_id: String(paymentId),
      p_order_id: payment.external_reference,
      p_items: payment.additional_info?.items // Formato: [{id: "...", quantity: 1}, ...]
    });

    if (rpcError) {
      console.error("[ERRO RPC]:", rpcError.message);
    } else {
      console.info(`[Webhook] Pedido ${payment.external_reference} processado com sucesso.`);
    }

  } catch (error) {
    console.error("[Webhook Fatal Error]:", error.message);
  }
};
