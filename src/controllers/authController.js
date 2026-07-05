import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { supabase } from "../config/supabase.js";
import { env } from "../config/env.js";
import { sendPasswordResetEmail } from "../services/passwordResetEmailService.js";

const MIN_PASSWORD_LENGTH = 6;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createResetUrl(token) {
  const baseUrl = `${env.frontendUrl.replace(/\/$/, "")}/`;
  const resetUrl = new URL("reset-password.html", baseUrl);
  resetUrl.searchParams.set("token", token);
  return resetUrl.toString();
}

export async function login(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
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
    return res.status(500).json({ ok: false, message: "Erro interno de autenticacao." });
  }
}

export async function requestPasswordReset(req, res) {
  const genericMessage = "Se o e-mail estiver cadastrado, enviaremos um link para redefinir sua senha.";

  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ ok: false, message: "Informe o e-mail cadastrado." });
    }

    const { data: employee, error } = await supabase
      .from("employees")
      .select("id, name, email")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("[password reset request lookup error]", error);
      return res.json({ ok: true, message: genericMessage });
    }

    if (!employee) {
      return res.json({ ok: true, message: genericMessage });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + env.passwordResetTokenMinutes * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from("employees")
      .update({
        password_reset_token_hash: tokenHash,
        password_reset_expires_at: expiresAt,
        password_reset_requested_at: new Date().toISOString()
      })
      .eq("id", employee.id);

    if (updateError) {
      console.error("[password reset request update error]", updateError);
      return res.status(500).json({ ok: false, message: "Nao foi possivel gerar a recuperacao de senha agora." });
    }

    const resetUrl = createResetUrl(token);
    try {
      await sendPasswordResetEmail({
        to: employee.email,
        name: employee.name,
        resetUrl
      });
    } catch (emailError) {
      console.error("[password reset email error]", emailError);
      return res.status(500).json({ ok: false, message: "Nao foi possivel enviar o e-mail de recuperacao agora." });
    }

    return res.json({ ok: true, message: genericMessage });
  } catch (error) {
    console.error("[password reset request error]", error);
    return res.status(500).json({ ok: false, message: "Erro interno ao solicitar recuperacao de senha." });
  }
}

export async function resetPassword(req, res) {
  try {
    const token = String(req.body?.token || "").trim();
    const newPassword = String(req.body?.newPassword || req.body?.password || "");

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({ ok: false, message: "Link de recuperacao invalido ou expirado." });
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ ok: false, message: `A senha deve ter no minimo ${MIN_PASSWORD_LENGTH} caracteres.` });
    }

    const tokenHash = hashResetToken(token);
    const now = new Date().toISOString();

    const { data: employee, error } = await supabase
      .from("employees")
      .select("id")
      .eq("password_reset_token_hash", tokenHash)
      .gt("password_reset_expires_at", now)
      .maybeSingle();

    if (error) {
      console.error("[password reset lookup error]", error);
      return res.status(500).json({ ok: false, message: "Nao foi possivel validar o link agora." });
    }

    if (!employee) {
      return res.status(400).json({ ok: false, message: "Link de recuperacao invalido ou expirado." });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await supabase
      .from("employees")
      .update({
        password_hash,
        password_reset_token_hash: null,
        password_reset_expires_at: null,
        password_reset_requested_at: null
      })
      .eq("id", employee.id);

    if (updateError) {
      console.error("[password reset update error]", updateError);
      return res.status(500).json({ ok: false, message: "Nao foi possivel atualizar a senha agora." });
    }

    return res.json({ ok: true, message: "Senha atualizada com sucesso. Faca login com a nova senha." });
  } catch (error) {
    console.error("[password reset error]", error);
    return res.status(500).json({ ok: false, message: "Erro interno ao redefinir senha." });
  }
}
