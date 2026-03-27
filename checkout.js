import { z } from "zod";

export const itemSchema = z.object({
  id: z.string().min(1),
  quantity: z.number().int().positive()
});

export const customerSchema = z.object({
  nome: z.string().min(2).max(120),
  telefone: z.string().min(8).max(30),
  idade: z.union([z.string(), z.number()]).optional().nullable(),
  profissao: z.string().max(120).optional().nullable(),
  casado: z.boolean().optional(),
  filhos: z.boolean().optional()
});

export const checkoutSchema = z.object({
  items: z.array(itemSchema).min(1),
  paymentMethod: z.enum(["pix", "debito", "credito", "vale"]),
  customer: customerSchema,
  source: z.string().optional().default("site")
});
