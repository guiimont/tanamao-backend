import { supabase } from "../config/supabase.js";

export async function createOrder(order) {
  const { data, error } = await supabase
    .from("orders")
    .insert(order)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateOrderByExternalReference(externalReference, patch) {
  const { data, error } = await supabase
    .from("orders")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("external_reference", externalReference)
    .select()
    .single();

  if (error) throw error;
  return data;
}
