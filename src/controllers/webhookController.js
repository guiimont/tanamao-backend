import { paymentClient } from "../config/mercadopago.js";
import { supabase } from "../config/supabase.js";

export const paymentWebhook = async (req, res) => {
  const { query, body } = req;
  
  // 1. Resposta imediata para o Mercado Pago evitar retentativas desnecessárias
  res.status(200).send("OK");

  try {
    // Captura o ID do pagamento independente do formato do Webhook
    const paymentId = query["data.id"] || body?.data?.id || body?.id;

    if (!paymentId || (body?.type && body.type !== "payment")) {
      return;
    }

    console.info(`[Webhook] Processando pagamento: ${paymentId}`);

    // 2. CONFIRMAÇÃO VIA API (A "Prova Real")
    // Buscamos os dados diretamente no servidor do MP usando o ID recebido
    const payment = await paymentClient.get({ id: String(paymentId) });

    // Verificamos se o status é realmente aprovado na fonte oficial
    if (payment.status !== "approved") {
      console.info(`[Webhook] Pagamento ${paymentId} ignorado. Status oficial: ${payment.status}`);
      return;
    }

    // 3. EXECUÇÃO DA RPC (Idempotência + Estoque + Auditoria)
    // Passamos o external_reference (ID do seu pedido) e os itens
    const { error: rpcError } = await supabase.rpc("process_order_stock", {
      p_payment_id: String(paymentId),
      p_order_id: payment.external_reference, 
      p_items: payment.additional_info?.items || []
    });

    if (rpcError) {
      console.error(`[Webhook Erro RPC]: ${rpcError.message}`);
    } else {
      console.info(`[Webhook Sucesso]: Pedido ${payment.external_reference} confirmado e auditado.`);
    }

  } catch (error) {
    // Caso o erro seja 404 no paymentClient.get, significa que o ID era falso/inválido
    console.error("[Webhook Erro de Validação]: ID inválido ou erro de comunicação com MP.");
  }
};
