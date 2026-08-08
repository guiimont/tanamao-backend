import { supabase } from "../config/supabase.js";
import { buildProductionRoundPlan } from "../services/productionRoundService.js";

const ALLOWED_STATUSES = new Set([
  "draft", "orders_closed", "purchasing", "producing", "packing", "delivering", "completed", "canceled"
]);

const STATUS_TRANSITIONS = {
  draft: new Set(["orders_closed", "canceled"]),
  orders_closed: new Set(["draft", "purchasing", "producing", "canceled"]),
  purchasing: new Set(["orders_closed", "producing", "canceled"]),
  producing: new Set(["packing", "canceled"]),
  packing: new Set(["delivering", "canceled"]),
  delivering: new Set(["completed", "canceled"]),
  completed: new Set(),
  canceled: new Set()
};

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function validateRoundInput(body = {}) {
  const title = String(body.title || "").trim();
  const orderCutoffAt = new Date(body.order_cutoff_at);
  const productionDate = String(body.production_date || "");
  const deliveryDate = String(body.delivery_date || "");
  const safetyMarginPercent = Number(body.safety_margin_percent || 0);
  if (!title) throw badRequest("Informe o nome da rodada.");
  if (Number.isNaN(orderCutoffAt.getTime())) throw badRequest("Informe uma data limite válida.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(productionDate)) throw badRequest("Informe uma data de produção válida.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) throw badRequest("Informe uma data de entrega válida.");
  if (deliveryDate < productionDate) throw badRequest("A entrega não pode acontecer antes da produção.");
  if (!Number.isFinite(safetyMarginPercent) || safetyMarginPercent < 0 || safetyMarginPercent > 100) {
    throw badRequest("A margem de segurança deve ficar entre 0 e 100%.");
  }
  return { title, orderCutoffAt: orderCutoffAt.toISOString(), productionDate, deliveryDate, safetyMarginPercent };
}

async function persistPlan(roundId, plan) {
  const { error: deleteError } = await supabase
    .from("production_round_orders")
    .delete()
    .eq("production_round_id", roundId);
  if (deleteError) throw deleteError;

  if (plan.orders.length) {
    const { error: orderError } = await supabase.from("production_round_orders").insert(
      plan.orders.map((order) => ({ production_round_id: roundId, order_id: order.id }))
    );
    if (orderError) throw orderError;
  }

  const { data, error } = await supabase.from("production_rounds").update({
    demand_json: plan.demand,
    shopping_json: plan.shopping,
    missing_requirements_json: plan.missing_requirements,
    summary_json: plan.summary,
    updated_at: new Date().toISOString()
  }).eq("id", roundId).select("*").single();
  if (error) throw error;
  return data;
}

export async function listProductionRounds(req, res) {
  try {
    const { data, error } = await supabase
      .from("production_rounds")
      .select("*")
      .order("production_date", { ascending: true });
    if (error) throw error;
    return res.json({ ok: true, rounds: data || [] });
  } catch (error) {
    console.error("[listProductionRounds]", error);
    return res.status(500).json({ ok: false, message: "Erro ao listar rodadas de produção." });
  }
}

export async function getProductionRound(req, res) {
  try {
    const { data: round, error } = await supabase
      .from("production_rounds")
      .select("*, production_round_orders(order_id, orders(*))")
      .eq("id", req.params.id)
      .single();
    if (error) throw error;
    return res.json({ ok: true, round });
  } catch (error) {
    console.error("[getProductionRound]", error);
    return res.status(error.code === "PGRST116" ? 404 : 500).json({ ok: false, message: "Rodada não encontrada." });
  }
}

export async function createProductionRound(req, res) {
  try {
    const input = validateRoundInput(req.body);
    const plan = await buildProductionRoundPlan({
      orderCutoffAt: input.orderCutoffAt,
      deliveryDate: input.deliveryDate,
      safetyMarginPercent: input.safetyMarginPercent
    });
    const { data: created, error } = await supabase.from("production_rounds").insert([{
      title: input.title,
      order_cutoff_at: input.orderCutoffAt,
      production_date: input.productionDate,
      delivery_date: input.deliveryDate,
      safety_margin_percent: input.safetyMarginPercent,
      notes: req.body.notes || null,
      created_by: req.user?.id || null
    }]).select("*").single();
    if (error) throw error;
    const round = await persistPlan(created.id, plan);
    return res.status(201).json({ ok: true, round, orders: plan.orders });
  } catch (error) {
    console.error("[createProductionRound]", error);
    return res.status(error.statusCode || 500).json({ ok: false, message: error.message || "Erro ao criar rodada." });
  }
}

export async function recalculateProductionRound(req, res) {
  try {
    const { data: current, error: currentError } = await supabase
      .from("production_rounds")
      .select("*")
      .eq("id", req.params.id)
      .single();
    if (currentError) throw currentError;
    if (current.status !== "draft") throw badRequest("Somente rodadas em rascunho podem ser recalculadas.");
    const plan = await buildProductionRoundPlan({
      orderCutoffAt: current.order_cutoff_at,
      deliveryDate: current.delivery_date,
      safetyMarginPercent: current.safety_margin_percent,
      excludeRoundId: current.id
    });
    const round = await persistPlan(current.id, plan);
    return res.json({ ok: true, round, orders: plan.orders });
  } catch (error) {
    console.error("[recalculateProductionRound]", error);
    return res.status(error.statusCode || 500).json({ ok: false, message: error.message || "Erro ao recalcular rodada." });
  }
}

export async function updateProductionRoundStatus(req, res) {
  try {
    const status = String(req.body?.status || "");
    if (!ALLOWED_STATUSES.has(status)) throw badRequest("Status de rodada inválido.");

    const { data: current, error: currentError } = await supabase
      .from("production_rounds")
      .select("id, status, missing_requirements_json")
      .eq("id", req.params.id)
      .single();
    if (currentError) throw currentError;
    if (status === current.status) return res.json({ ok: true, round: current });
    if (!STATUS_TRANSITIONS[current.status]?.has(status)) {
      throw badRequest(`Não é possível passar de ${current.status} para ${status}.`);
    }
    if (status === "orders_closed" && (current.missing_requirements_json || []).length) {
      throw badRequest("Complete as fichas técnicas pendentes antes de fechar os pedidos da rodada.");
    }

    const { data, error } = await supabase.from("production_rounds").update({
      status,
      updated_at: new Date().toISOString()
    }).eq("id", req.params.id).select("*").single();
    if (error) throw error;
    return res.json({ ok: true, round: data });
  } catch (error) {
    console.error("[updateProductionRoundStatus]", error);
    return res.status(error.statusCode || 500).json({ ok: false, message: error.message || "Erro ao atualizar rodada." });
  }
}
