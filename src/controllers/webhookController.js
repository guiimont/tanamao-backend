import crypto from "crypto";
import { supabase } from "../config/supabase.js";
import { env } from "../config/env.js";

export async function paymentWebhook(req, res) {
  try {
    const signatureHeader = req.headers["x-signature"];
    const payload = req.body;

    // 1. Validação de Autenticidade
    if (env.webhookSecret) {
      if (!signatureHeader) {
        return res.status(403).json({ ok: false, message: "Missing signature" });
      }

      const parts = signatureHeader.split(",");
      const ts = parts.find(p => p.startsWith("ts="))?.split("=")[1];
      const v1 = parts.find(p => p.startsWith("v1="))?.split("=")[1];
      const dataId = payload.data?.id || req.query["data.id"];

      const manifest = `id:${dataId};request-id:;ts:${ts};`;
      const hash = crypto.createHmac("sha256", env.webhookSecret).update(manifest).digest("hex");

      if (hash !== v1) {
        return res.status(403).json({ ok: false, message: "Invalid signature" });
      }
    }

    // 2. Extração de dados
    const paymentStatus = payload.payment?.status || payload.type; 
    const paymentId = payload.payment?.id || payload.data?.id;
    const orderId = payload.order?.id || payload.external_reference; 

    if (paymentStatus !== "approved" && paymentStatus !== "authorized") {
      return res.status(200).json({ ok: true, message: "Event ignored" });
    }

    // 3. Busca do Pedido para obter itens_json (necessário para a RPC)
    const { data: orderData } = await supabase
      .from('orders')
      .select('id, items_json')
      .eq('external_reference', orderId)
      .single();

    if (!orderData) {
      return res.status(404).json({ ok: false, message: "Order not found" });
    }

    // 4. Execução da RPC (Baixa de Estoque + Idempotência)
    const { error: rpcError } = await supabase.rpc("process_order_stock", {
      p_payment_id: String(paymentId),
      p_order_id: String(orderData.id),
      p_items: orderData.items_json
    });

    if (rpcError) {
      return res.status(422).json({ ok: false, message: rpcError.message });
    }

    // 5. Atualização de Status Finalizado
    await supabase
      .from('orders')
      .update({ payment_status: 'approved' })
      .eq('id', orderData.id);

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("[webhook:fatal_error]", error.message);
    return res.status(500).json({ ok: false, message: "Internal Server Error" });
  }
}
