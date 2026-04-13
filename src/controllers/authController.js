import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../config/supabase.js";
import { env } from "../config/env.js";

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ ok: false, message: "Credenciais incompletas." });

    const { data: employee, error } = await supabase
      .from("employees")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !employee) {
      return res.status(401).json({ ok: false, message: "E-mail ou senha incorretos." });
    }

    const validPassword = await bcrypt.compare(password, employee.password_hash);
    if (!validPassword) {
      return res.status(401).json({ ok: false, message: "E-mail ou senha incorretos." });
    }

    const token = jwt.sign(
      { id: employee.id, role: employee.role, email: employee.email },
      env.jwtSecret,
      { expiresIn: "8h" }
    );

    return res.json({
      ok: true,
      token,
      user: { id: employee.id, name: employee.name, role: employee.role }
    });
  } catch (error) {
    console.error("[login error]", error);
    return res.status(500).json({ ok: false, message: "Erro interno de autenticação." });
  }
}
