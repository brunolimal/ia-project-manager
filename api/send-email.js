import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { to, subject, html } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Campos to, subject e html são obrigatórios' });
  }

  try {
    const data = await resend.emails.send({
      from: 'IA Project Manager <noreply@maisescoramentos.com.br>',
      to: to,
      subject: subject,
      html: html,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return res.status(500).json({ error: error.message });
  }
}
