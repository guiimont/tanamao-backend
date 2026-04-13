import bcrypt from "bcryptjs";
import { supabase } from "../config/supabase.js";

export async function listEmployees(req, res) {
  const { data, error } = await supabase.from("employees").select("id, name, email, role, created_at");
  if (error) return res.status(500).json({ ok: false, message: error.message });
  return res.json({ ok: true, employees: data });
}

export async function createEmployee(req, res) {
  try {
    const { name, email, password, role } = req.body;
    const password_hash = await bcrypt.hash(password, 10);
    
    const { data, error } = await supabase
      .from("employees")
      .insert([{ name, email, password_hash, role: role || "operador" }])
      .select("id, name, email, role")
      .single();

    if (error) throw error;
    return res.status(201).json({ ok: true, employee: data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro ao criar usuário." });
  }
}

export async function updatePassword(req, res) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    // RBAC dinâmico: Usuário só altera a própria senha, a menos que seja Admin
    if (req.user.role !== "admin" && req.user.id !== id) {
      return res.status(403).json({ ok: false, message: "Operação não permitida." });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    const { error } = await supabase.from("employees").update({ password_hash }).eq("id", id);

    if (error) throw error;
    return res.json({ ok: true, message: "Senha atualizada com sucesso." });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro ao atualizar senha." });
  }
}
