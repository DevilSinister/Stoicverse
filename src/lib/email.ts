import "server-only";

type Email = { to: string; subject: string; html: string };

export async function sendTransactionalEmail({ to, subject, html }: Email) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) throw new Error("Unable to deliver transactional email.");
}
