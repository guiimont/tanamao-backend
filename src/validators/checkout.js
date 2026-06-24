import { z } from "zod";

export const itemSchema = z.object({
  id: z.string().min(1),
  quantity: z.number().int().positive()
});

export const customerSchema = z.object({
  nome: z.string().min(2).max(120),
  telefone: z.string().min(8).max(30),
  endereco: z.object({
    cep: z.string().optional().nullable(),
    rua: z.string().optional().nullable(),
    numero: z.string().optional().nullable(),
    complemento: z.string().optional().nullable(),
    bairro: z.string().optional().nullable(),
    cidade: z.string().optional().nullable(),
    estado: z.string().optional().nullable()
  }).optional().nullable(),
  idade: z.union([z.string(), z.number()]).optional().nullable(),
  profissao: z.string().max(120).optional().nullable(),
  casado: z.boolean().optional(),
  filhos: z.boolean().optional()
});

export const checkoutSchema = z.object({
  items: z.array(itemSchema).min(1),
  paymentMethod: z.enum(["pix", "debito", "credito", "vale"]),
  customer: customerSchema,
  fulfillment: z.object({
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    deliveryWindow: z.string().max(80).optional(),
    type: z.enum(["delivery", "pickup"]).optional().default("delivery")
  }).optional(),
  source: z.string().optional().default("site")
});
