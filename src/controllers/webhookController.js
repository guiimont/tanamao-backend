export async function paymentWebhook(req, res) {
  try {
    console.log("[mercadopago:webhook] body:", JSON.stringify(req.body || {}));
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[payments:webhook]", error);
    return res.status(500).json({ ok: false });
  }
}
