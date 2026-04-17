import crypto from "crypto";
import { supabase } from "../config/supabase.js";
import { env } from "../config/env.js";

export async function paymentWebhook(req, res) {
  try {
    const signatureHeader = req.headers["x-signature"];
    const payload = req.body;

    // 1. Validação de Autenticidade (Padrão Oficial Mercado Pago)
    if (env.webhookSecret) {
      if (!signatureHeader) {
        console.warn("[webhook] Assinatura ausente");
        return res.status(403).json({ ok: false, message: "Missing signature" });
      }

      // Extrai timestamp (ts) e o hash (v1) do header
      const parts = signatureHeader.split(",");
      const tsPart = parts.find(p => p.startsWith("ts="));
      const v1Part = parts.find(p => p.startsWith("v1="));

      if (!tsPart || !v1Part) {
        return res.status(403).json({ ok: false, message: "Invalid signature format" });
      }

      const ts = tsPart.split("=")[1];
      const v1 = v1Part.split("=")[1];

      // O Mercado Pago envia o ID do recurso em data.id ou via query parameter
      const dataId = payload.data?.id || req.query["data.id"];

      // Monta o manifesto para validar conforme docs do MP
      const manifest = `id:${dataId};request-id:;ts:${ts};`;

      const hash = crypto
        .createHmac("sha256", env.webhookSecret)
        .update(manifest)
        .digest("hex");

      if (hash !== v1) {
        console.warn("[webhook] Assinatura inválida detectada");
        return res.status(403).json({ ok: false, message: "Invalid signature" });
      }
    }

    // 2. Extração de dados do payload
    // ASSUNÇÃO: Adaptando para o seu fluxo de e-commerce 'Tanamao'
    const paymentStatus = payload.payment?.status || payload.type; 
    const paymentId = payload.payment?.id || payload.data?.id;
    const orderId = payload.order?.id;
    const itemsJson = payload.order?.items_json;

    // 3. Filtro de Status Gatilho
    // Só processamos se o pagamento estiver aprovado ou autorizado
    if (paymentStatus !== "approved" && paymentStatus !== "authorized") {
      console.log(`[webhook] Evento recebido (${paymentStatus}), mas ignorado.`);
      return res.status(200).json({ ok: true, message: "Event ignored" });
    }

    if (!paymentId || !orderId || !itemsJson) {
      console.error("[webhook] Dados insuficientes no payload", { paymentId, orderId });
      return res.status(400).json({ ok: false, message: "Incomplete payload" });
    }

    // 4. Execução da RPC no Supabase (Baixa de Estoque + Idempotência)
    const { data, error } = await supabase.rpc("process_order_stock", {
      p_payment_id: String(paymentId),
      p_order_id: String(orderId),
      p_items: itemsJson
    });

    if (error) {
      if (error.message.includes("Estoque insuficiente") || error.message.includes("não encontrado")) {
        console.error(`[webhook:business_error] ${error.message}`);
        // Retornamos 422 para o MP saber que o erro foi processado mas não aceito por regra de negócio
        return res.status(422).json({ ok: false, message: error.message });
      }
      throw error;
    }

    console.log(`[webhook:success] Estoque atualizado para o pedido: ${orderId}`);
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("[webhook:fatal_error]", error.message);
    return res.status(500).json({ ok: false, message: "Internal Server Error" });
  }
}
