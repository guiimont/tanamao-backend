import crypto from "crypto";
import { paymentClient } from "../config/mercadopago.js";
import { supabase } from "../config/supabase.js";
import { env } from "../config/env.js";

export const paymentWebhook = async (req, res) => {
  const { query, body, headers } = req;
  
  // 1. Resposta imediata para evitar retentativas excessivas do Mercado Pago
  res.status(200).send("OK");

  try {
    const paymentId = query["data.id"] || body?.data?.id;
    if (!paymentId) return;

    // 2. Validação de Autenticidade (Segurança de Produção)
    if (env.webhookSecret) {
      const signatureHeader = headers["x-signature"];
      if (!signatureHeader) {
        console.warn(`[Webhook] Assinatura ausente para pagamento ${paymentId}`);
        return;
      }

      const parts = signatureHeader.split(",");
      const ts = parts.find(p => p.startsWith("ts="))?.split("=")[1];
      const v1 = parts.find(p => p.startsWith("v1="))?.split("=")[1];

      const manifest = `id:${paymentId};request-id:;ts:${ts};`;
      const hash = crypto.createHmac("sha256", env.webhookSecret).update(manifest).digest("hex");

      if (hash !== v1) {
        console.error(`[Webhook] Assinatura inválida para pagamento ${paymentId}`);
        return;
      }
    }

    // 3. Buscar detalhes oficiais do pagamento
    const payment = await paymentClient.get({ id: paymentId });

    if (payment.status !== "approved") {
      console.info(`[Webhook] Pagamento ${paymentId} ignorado (Status: ${payment.status})`);
      return;
    }

    // 4. Checar se este pagamento já foi processado (Evita erro de estoque duplicado)
    const { data: existingSale } = await supabase
      .from("sales")
      .select("status")
      .eq("external_reference", payment.external_reference)
      .single();

    if (existingSale?.status === "pago") {
      console.info(`[Webhook] Pagamento ${paymentId} já processado anteriormente.`);
      return;
    }

    console.info(`[Webhook] Processando baixa de estoque: Pedido ${payment.external_reference}`);

    // 5. Recuperar itens e baixar estoque via RPC
    const items = payment.additional_info?.items || [];
    
    for (const item of items) {
      const { error: stockError } = await supabase.rpc("decrement_stock", {
        p_product_id: item.id,
        p_quantity: parseInt(item.quantity)
      });

      if (stockError) {
        console.error(`[ERRO ESTOQUE] Item ${item.id}: ${stockError.message}`);
        // Logar o erro em uma tabela de auditoria se necessário
      }
    }

    // 6. Atualizar a venda para 'pago'
    const { error: updateError } = await supabase
      .from("sales")
      .update({ 
        status: "pago", 
        updated_at: new Date().toISOString(),
        payment_id: paymentId // Guardamos o ID do MP para referência
      })
      .eq("external_reference", payment.external_reference);

    if (updateError) {
      console.error(`[Webhook] Erro ao atualizar venda ${payment.external_reference}:`, updateError.message);
    } else {
      console.info(`[Webhook] Venda ${payment.external_reference} finalizada com sucesso.`);
    }

  } catch (error) {
    console.error("[Webhook Fatal Error]:", error.message);
  }
};
