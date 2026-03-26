import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import { env } from "./env.js";

export const mpClient = new MercadoPagoConfig({
  accessToken: env.mercadoPagoAccessToken
});

export const preferenceClient = new Preference(mpClient);
export const paymentClient = new Payment(mpClient);
