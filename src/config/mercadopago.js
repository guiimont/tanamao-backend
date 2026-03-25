import { MercadoPagoConfig, Preference } from "mercadopago";
import { env } from "./env.js";

if (!env.mercadoPagoAccessToken) {
  console.warn("[warn] MERCADOPAGO_ACCESS_TOKEN não configurado.");
}

export const mpClient = new MercadoPagoConfig({
  accessToken: env.mercadoPagoAccessToken
});

export const preferenceClient = new Preference(mpClient);
