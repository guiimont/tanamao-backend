import nodemailer from "nodemailer";
import { env } from "../config/env.js";

function hasSmtpConfig() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass
    }
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  if (!hasSmtpConfig()) {
    console.warn("[password reset] SMTP nao configurado. Configure SMTP_HOST, SMTP_USER e SMTP_PASS para enviar e-mails.");
    if (!env.isProduction) {
      console.info(`[password reset] Link local: ${resetUrl}`);
    }
    return { sent: false, reason: "smtp_not_configured" };
  }

  const displayName = name || "equipe";
  const safeDisplayName = escapeHtml(displayName);
  const safeResetUrl = escapeHtml(resetUrl);
  const transporter = createTransporter();
  console.info(`[password reset] Enviando via SMTP ${env.smtpHost}:${env.smtpPort} secure=${env.smtpSecure}`);

  await transporter.sendMail({
    from: env.passwordResetFromEmail,
    to,
    subject: "Redefinicao de senha - Ta na Mao",
    text: [
      `Ola, ${displayName}.`,
      "",
      "Recebemos uma solicitacao para redefinir sua senha do painel Ta na Mao.",
      `Acesse o link abaixo para criar uma nova senha. O link expira em ${env.passwordResetTokenMinutes} minutos.`,
      "",
      resetUrl,
      "",
      "Se voce nao solicitou essa alteracao, ignore este e-mail."
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2933;">
        <p>Ola, ${safeDisplayName}.</p>
        <p>Recebemos uma solicitacao para redefinir sua senha do painel Ta na Mao.</p>
        <p>O link abaixo expira em <strong>${env.passwordResetTokenMinutes} minutos</strong>.</p>
        <p>
          <a href="${safeResetUrl}" style="display:inline-block;background:#0f7a4a;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;">
            Criar nova senha
          </a>
        </p>
        <p>Se o botao nao abrir, copie e cole este link no navegador:</p>
        <p style="word-break:break-all;"><a href="${safeResetUrl}">${safeResetUrl}</a></p>
        <p>Se voce nao solicitou essa alteracao, ignore este e-mail.</p>
      </div>
    `
  });

  return { sent: true };
}
