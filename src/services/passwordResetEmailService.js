import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const SEND_TIMEOUT_MS = 15000;

function hasSmtpConfig() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
}

function hasBrevoConfig() {
  return Boolean(env.brevoApiKey);
}

function hasResendConfig() {
  return Boolean(env.resendApiKey);
}

function getEmailProvider() {
  if (env.emailProvider) return env.emailProvider;
  if (hasBrevoConfig()) return "brevo";
  if (hasResendConfig()) return "resend";
  if (hasSmtpConfig()) return "smtp";
  return "";
}

function createTransporter() {
  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
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

function parseEmailAddress(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(.*?)<([^>]+)>$/);
  if (!match) return { name: "", email: raw };

  return {
    name: match[1].trim().replace(/^"|"$/g, ""),
    email: match[2].trim()
  };
}

function createMessage({ name, resetUrl }) {
  const displayName = name || "equipe";
  const safeDisplayName = escapeHtml(displayName);
  const safeResetUrl = escapeHtml(resetUrl);
  const subject = "Redefinicao de senha - Ta na Mao";
  const text = [
    `Ola, ${displayName}.`,
    "",
    "Recebemos uma solicitacao para redefinir sua senha do painel Ta na Mao.",
    `Acesse o link abaixo para criar uma nova senha. O link expira em ${env.passwordResetTokenMinutes} minutos.`,
    "",
    resetUrl,
    "",
    "Se voce nao solicitou essa alteracao, ignore este e-mail."
  ].join("\n");
  const html = `
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
  `;

  return { subject, text, html };
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function assertEmailApiResponse(response, provider) {
  if (response.ok) return;

  const errorText = await response.text().catch(() => "");
  const detail = errorText ? ` ${errorText.slice(0, 500)}` : "";
  throw new Error(`${provider} email API failed with status ${response.status}.${detail}`);
}

async function sendViaBrevo({ to, name, message }) {
  const sender = parseEmailAddress(env.passwordResetFromEmail);
  console.info("[password reset] Enviando via Brevo API");

  const response = await fetchWithTimeout("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": env.brevoApiKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to, name: name || undefined }],
      subject: message.subject,
      textContent: message.text,
      htmlContent: message.html
    })
  });

  await assertEmailApiResponse(response, "Brevo");
  return { sent: true, provider: "brevo" };
}

async function sendViaResend({ to, message }) {
  console.info("[password reset] Enviando via Resend API");

  const response = await fetchWithTimeout("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.resendApiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: env.passwordResetFromEmail,
      to: [to],
      subject: message.subject,
      text: message.text,
      html: message.html
    })
  });

  await assertEmailApiResponse(response, "Resend");
  return { sent: true, provider: "resend" };
}

async function sendViaSmtp({ to, message }) {
  console.info(`[password reset] Enviando via SMTP ${env.smtpHost}:${env.smtpPort} secure=${env.smtpSecure}`);
  const transporter = createTransporter();

  await transporter.sendMail({
    from: env.passwordResetFromEmail,
    to,
    subject: message.subject,
    text: message.text,
    html: message.html
  });

  return { sent: true, provider: "smtp" };
}

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const provider = getEmailProvider();
  if (!provider) {
    console.warn("[password reset] Nenhum provedor de e-mail configurado. Configure EMAIL_PROVIDER com Brevo, Resend ou SMTP.");
    if (!env.isProduction) {
      console.info(`[password reset] Link local: ${resetUrl}`);
    }
    return { sent: false, reason: "email_provider_not_configured" };
  }

  const message = createMessage({ name, resetUrl });

  if (provider === "brevo") {
    if (!hasBrevoConfig()) throw new Error("BREVO_API_KEY nao configurada.");
    return sendViaBrevo({ to, name, message });
  }

  if (provider === "resend") {
    if (!hasResendConfig()) throw new Error("RESEND_API_KEY nao configurada.");
    return sendViaResend({ to, message });
  }

  if (provider === "smtp") {
    if (!hasSmtpConfig()) throw new Error("SMTP_HOST, SMTP_USER e SMTP_PASS precisam estar configurados.");
    return sendViaSmtp({ to, message });
  }

  throw new Error(`EMAIL_PROVIDER invalido: ${provider}`);
}
