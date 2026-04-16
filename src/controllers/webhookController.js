import crypto from "crypto";
import { supabase } from "../config/supabase.js";
import { env } from "../config/env.js"; // ASSUNÇÃO: webhookSecret adicionado aqui

export async function stockWebhook(req, res) {
  try {
    const signature = req.headers["x-signature"];
    const payload = req.body;

    // 1. Validação de Autenticidade (Exemplo HMAC SHA256)
    // ASSUNÇÃO: O gateway envia a assinatura no header x-signature
    if (env.webhookSecret) {
      const hash = crypto
        .createHmac("sha256", env.webhookSecret)
        .update(JSON.stringify(payload))
        .digest("hex");

      if (hash !== signature) {
        console.warn("[webhook] Assinatura inválida", { paymentId: payload?.payment?.id });
        return res.status(403).json({ ok: false, message: "Invalid signature" });
      }
    }

    const eventType = payload.event;
    const paymentStatus = payload.payment?.status;
    const paymentId = payload.payment?.id;
    const orderId = payload.order?.id;
    const itemsJson = payload.order?.items_json;

    // 2. Filtro de Status Gatilho
    if (paymentStatus !== "approved" && paymentStatus !== "authorized") {
      console.log(`[webhook] Ignorado. Status: ${paymentStatus} - Pagamento: ${paymentId}`);
      return res.status(200).json({ ok: true, ignored: true });
    }

    if (!paymentId || !orderId || !itemsJson || !Array.isArray(itemsJson)) {
      return res.status(400).json({ ok: false, message: "Payload malformado" });
    }

    // 3. Chamada da RPC no Supabase (Transação + Idempotência no banco)
    const { data, error } = await supabase.rpc("process_order_stock", {
      p_payment_id: String(paymentId),
      p_order_id: String(orderId),
      p_items: itemsJson
    });

    if (error) {
      // Diferenciar erros de negócio (ex: estoque insuficiente) de erros de infra
      if (error.message.includes("Estoque insuficiente") || error.message.includes("Produto não encontrado")) {
        console.error(`[webhook:business_error] ${error.message} (Order: ${orderId})`);
        // Pode retornar 200 pro gateway parar de tentar, mas registrar um alerta no seu log.
        // ASSUNÇÃO: Optamos por falhar o webhook (422) para que o Gateway registre a falha ou notifique.
        return res.status(422).json({ ok: false, message: error.message });
      }
      throw error;
    }

    console.log(`[webhook:success] Baixa de estoque concluída. Order: ${orderId}`);
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("[webhook:fatal_error]", error);
    return res.status(500).json({ ok: false, message: "Internal server error" });
  }
}
