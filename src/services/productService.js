import { supabase } from "../config/supabase.js";

export async function listActiveProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, description, price, active, sort_order, stock_quantity, available_days, lead_time_hours, max_units_per_day")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getProductsMapByIds(ids) {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, description, price, active, stock_quantity, available_days, lead_time_hours, max_units_per_day")
    .in("id", ids)
    .eq("active", true);

  if (error) throw error;

  const map = new Map();
  for (const item of data || []) {
    map.set(item.id, item);
  }
  return map;
}
