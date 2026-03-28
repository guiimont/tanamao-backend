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

export async function listOperationalOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      external_reference,
      customer_name,
      customer_phone,
      payment_status,
      delivery_status,
      delivery_address,
      total,
      items_json,
      created_at,
      updated_at
    `)
    .in("payment_status", ["approved", "pending"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function updateOrderStatusById(id, patch) {
  const finalPatch = {
    ...patch,
    updated_at: new Date().toISOString()
  };

  if (patch.delivery_status === "preparing") {
    finalPatch.production_started_at = new Date().toISOString();
  }

  if (patch.delivery_status === "ready") {
    finalPatch.production_finished_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("orders")
    .update(finalPatch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
