import { paymentClient } from "../config/mercadopago.js";
import { supabase } from "../config/supabase.js";

function getPaymentId(req) {
  return req.query["data.id"] || req.body?.data?.id || req.body?.id || null;
}

export async function paymentWebhook(req, res) {
  try {
    const paymentId = getPaymentId(req);

    if (!paymentId || (req.body?.type && req.body.type !== "payment")) {
      return res.status(200).json({ ok: true, message: "Event ignored" });
    }

    const payment = await paymentClient.get({ id: String(paymentId) });

    if (payment.status !== "approved") {
      return res.status(200).json({
        ok: true,
        message: `Payment ignored with status ${payment.status}`
      });
    }

    if (!payment.external_reference) {
      return res.status(422).json({
        ok: false,
        message: "Payment missing external_reference"
      });
    }

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("id, external_reference, items_json")
      .eq("external_reference", payment.external_reference)
      .single();

    if (orderError || !orderData) {
      return res.status(404).json({
        ok: false,
        message: "Order not found"
      });
    }

    const { error: rpcError } = await supabase.rpc("process_order_stock", {
      p_payment_id: String(paymentId),
      p_order_id: String(orderData.id),
      p_items: orderData.items_json || []
    });

    if (rpcError) {
      console.error("[webhook:process_order_stock]", rpcError);
      return res.status(422).json({
        ok: false,
        message: rpcError.message
      });
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: "approved",
        updated_at: new Date().toISOString()
      })
      .eq("id", orderData.id);

    if (updateError) {
      console.error("[webhook:update_order]", updateError);
      return res.status(422).json({
        ok: false,
        message: updateError.message
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[webhook:fatal_error]", error?.message || error);
    return res.status(500).json({
      ok: false,
      message: "Internal Server Error"
    });
  }
}
