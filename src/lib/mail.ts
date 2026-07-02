import nodemailer from "nodemailer";
import { getGeneralSettings, getSmtpSettings } from "./settings";
import { audit } from "./audit";

/**
 * Envoie un mail via le SMTP paramétré. Ne lève jamais d'exception :
 * un échec d'envoi ne doit pas bloquer un workflow.
 */
export async function sendMail(
  to: string[],
  subject: string,
  html: string,
): Promise<boolean> {
  const recipients = [...new Set(to.filter(Boolean))];
  if (recipients.length === 0) return false;

  const smtp = await getSmtpSettings();
  if (!smtp?.host) {
    console.warn(`[mail] SMTP non configuré — mail « ${subject} » non envoyé.`);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
      tls: { rejectUnauthorized: false }, // relais internes souvent en certificat auto-signé
    });
    await transporter.sendMail({
      from: smtp.from,
      to: recipients.join(", "),
      subject,
      html,
    });
    return true;
  } catch (e) {
    console.error("[mail] Échec d'envoi", e);
    await audit("MAIL_ECHEC", {
      cible: subject,
      details: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}

/** Gabarit HTML sobre pour les notifications. */
export async function mailLayout(
  title: string,
  lines: string[],
  actionPath?: string,
  actionLabel?: string,
): Promise<string> {
  const general = await getGeneralSettings();
  const button =
    actionPath && general.appUrl
      ? `<p style="margin:24px 0"><a href="${general.appUrl}${actionPath}"
          style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;
          text-decoration:none;font-weight:600">${actionLabel ?? "Ouvrir dans Sésame"}</a></p>`
      : "";
  return `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;
       color:#0f172a;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px">
    <p style="font-size:13px;color:#64748b;margin:0 0 16px">🔑 Sésame — ${general.orgName}</p>
    <h2 style="font-size:18px;margin:0 0 16px">${title}</h2>
    ${lines.map((l) => `<p style="font-size:14px;line-height:1.6;margin:8px 0">${l}</p>`).join("")}
    ${button}
    <p style="font-size:12px;color:#94a3b8;margin:24px 0 0">
      Message automatique — merci de ne pas répondre.</p>
  </div>`;
}
