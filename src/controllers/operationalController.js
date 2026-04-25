import { supabase } from "../config/supabase.js";

export const getOperationalData = async (req, res) => {
  try {
    // 1. Buscar pedidos com pagamento confirmado (Regra de Negócio)
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "pago")
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;

    // 2. Buscar resumo de estoque baixo
    const { data: lowStock, error: stockError } = await supabase
      .from("products")
      .select("name, stock_quantity")
      .lt("stock_quantity", 5);

    if (stockError) throw stockError;

    // Retorno unificado para o Kanban
    return res.json({
      ok: true,
      orders: orders || [],
      alerts: {
        lowStock: lowStock || []
      }
    });
  } catch (error) {
    console.error("[OperationalController Error]:", error.message);
    return res.status(500).json({
      ok: false,
      message: "Erro ao carregar dados operacionais."
    });
  }
};
