import { paymentClient } from "../config/mercadopago.js";
import { updateOrderByExternalReference } from "../services/orderService.js";

export async function paymentWebhook(req, res) {
  try {
    console.log("[mercadopago:webhook] body:", JSON.stringify(req.body || {}));

    const paymentId = req.body?.data?.id || req.query?.['data.id'];
    const type = req.body?.type || req.query?.type;

    if (type !== "payment" || !paymentId) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const payment = await paymentClient.get({ id: paymentId });
    const paymentData = payment;

    const externalReference = paymentData.external_reference;
    const status = paymentData.status || "unknown";

    if (externalReference) {
      await updateOrderByExternalReference(externalReference, {
        payment_status: status,
        mp_payment_id: String(paymentId)
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[payments:webhook]", error);
    return res.status(500).json({ ok: false });
  }
}
