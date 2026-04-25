import { supabase } from "../config/supabase.js";

export const getOperationalData = async (req, res) => {
  try {
    // 1. Buscar pedidos pendentes e preparados para o Kanban
    const { data: orders, error: ordersError } = await supabase
      .from("sales")
      .select("*")
      .in("status", ["pago", "preparando", "enviado"])
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;

    // 2. Buscar resumo de estoque baixo (opcional para o painel)
    const { data: lowStock, error: stockError } = await supabase
      .from("products")
      .select("name, stock_quantity")
      .lt("stock_quantity", 5);

    if (stockError) throw stockError;

    return res.json({
      ok: true,
      orders,
      alerts: {
        lowStock
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
