import { supabase } from "../config/supabase.js";

const ALLOWED_DELIVERY_STATUS = new Set([
  "pending",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "canceled",
]);

export const getOperationalData = async (req, res) => {
  try {
    // 1) Pedidos com pagamento aprovado (fonte de verdade)
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .eq("payment_status", "approved")
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;

    // 2) Resumo de estoque baixo
    const { data: lowStock, error: stockError } = await supabase
      .from("products")
      .select("name, stock_quantity")
      .lt("stock_quantity", 5);

    if (stockError) throw stockError;

    return res.json({
      ok: true,
      orders: orders || [],
      alerts: {
        lowStock: lowStock || [],
      },
    });
  } catch (error) {
    console.error("[OperationalController Error]:", error?.message || error);
    return res.status(500).json({
      ok: false,
      message: "Erro ao carregar dados operacionais.",
    });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { delivery_status } = req.body;

    if (!ALLOWED_DELIVERY_STATUS.has(delivery_status)) {
      return res.status(400).json({
        ok: false,
        message: "delivery_status inválido.",
      });
    }

    const { data, error } = await supabase
      .from("orders")
      .update({
        delivery_status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    return res.json({ ok: true, order: data });
  } catch (error) {
    console.error("[updateOrderStatus]", error?.message || error);
    return res.status(500).json({
      ok: false,
      message: "Erro ao atualizar status do pedido.",
    });
  }
};

// NOVO: Iniciar Produção (baixa estoque no banco via RPC start_production)
export const startProduction = async (req, res) => {
  try {
    const { id } = req.params; // orders.id (uuid)

    const { data, error } = await supabase.rpc("start_production", {
      p_order_id: id,
    });

    if (error) {
      console.error("[startProduction rpc error]", error);
      return res.status(422).json({ ok: false, message: error.message });
    }

    // "data" já é um jsonb retornado pela RPC, ex:
    // { ok: true, delivery_status: "ready"|"preparing", issues: [...] }
    return res.json(data);
  } catch (e) {
    console.error("[startProduction]", e?.message || e);
    return res.status(500).json({
      ok: false,
      message: "Erro ao iniciar produção.",
    });
  }
};
