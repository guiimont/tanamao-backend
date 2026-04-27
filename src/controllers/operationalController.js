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
