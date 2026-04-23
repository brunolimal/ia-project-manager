import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@maisescoramentos.com.br';
const FROM_EMAIL = process.env.FROM_EMAIL || 'notificacoes@maisescoramentos.com.br';

interface Solicitacao {
  id: string;
  titulo: string;
  descricao?: string;
  status: string;
  prioridade?: string;
  criadoPor: {
    nome: string;
    email: string;
  };
}

// ✉️ E-mail para NOVA SOLICITAÇÃO
export async function enviarEmailNovaSolicitacao(solicitacao: Solicitacao) {
  const { id, titulo, descricao, prioridade, criadoPor } = solicitacao;

  // E-mail para o ADMIN
  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `🆕 Nova Solicitação: ${titulo}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Nova Solicitação Criada</h2>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px;">
          <p><strong>Título:</strong> ${titulo}</p>
          <p><strong>Descrição:</strong> ${descricao || 'Não informada'}</p>
          <p><strong>Prioridade:</strong> ${prioridade || 'Normal'}</p>
          <p><strong>Solicitante:</strong> ${criadoPor.nome} (${criadoPor.email})</p>
        </div>
        <p style="margin-top: 20px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/solicitacoes/${id}" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Ver Solicitação
          </a>
        </p>
      </div>
    `,
  });

  // E-mail para o SOLICITANTE (confirmação)
  await resend.emails.send({
    from: FROM_EMAIL,
    to: criadoPor.email,
    subject: `✅ Solicitação Recebida: ${titulo}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Sua Solicitação foi Recebida!</h2>
        <p>Olá, ${criadoPor.nome}!</p>
        <p>Sua solicitação foi criada com sucesso e será analisada em breve.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Título:</strong> ${titulo}</p>
          <p><strong>Status:</strong> Pendente</p>
          <p><strong>ID:</strong> #${id.slice(-6).toUpperCase()}</p>
        </div>
        <p>Você receberá um e-mail sempre que houver atualizações.</p>
        <p style="margin-top: 20px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/solicitacoes/${id}" 
             style="background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Acompanhar Solicitação
          </a>
        </p>
      </div>
    `,
  });
}

// ✉️ E-mail para MUDANÇA DE STATUS
export async function enviarEmailMudancaStatus(
  solicitacao: Solicitacao,
  statusAnterior: string,
  statusNovo: string,
  alteradoPor?: string
) {
  const { id, titulo, criadoPor } = solicitacao;

  const statusLabels: Record<string, { label: string; color: string; emoji: string }> = {
    pendente: { label: 'Pendente', color: '#f59e0b', emoji: '⏳' },
    em_analise: { label: 'Em Análise', color: '#3b82f6', emoji: '🔍' },
    em_andamento: { label: 'Em Andamento', color: '#8b5cf6', emoji: '🚀' },
    aprovado: { label: 'Aprovado', color: '#16a34a', emoji: '✅' },
    recusado: { label: 'Recusado', color: '#dc2626', emoji: '❌' },
    concluido: { label: 'Concluído', color: '#059669', emoji: '🎉' },
  };

  const status = statusLabels[statusNovo] || { label: statusNovo, color: '#6b7280', emoji: '📋' };

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${status.color};">${status.emoji} Status Atualizado</h2>
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px;">
        <p><strong>Solicitação:</strong> ${titulo}</p>
        <p><strong>Status anterior:</strong> ${statusLabels[statusAnterior]?.label || statusAnterior}</p>
        <p><strong>Novo status:</strong> 
          <span style="background: ${status.color}; color: white; padding: 4px 12px; border-radius: 4px;">
            ${status.label}
          </span>
        </p>
        ${alteradoPor ? `<p><strong>Alterado por:</strong> ${alteradoPor}</p>` : ''}
      </div>
      <p style="margin-top: 20px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/solicitacoes/${id}" 
           style="background: ${status.color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Ver Detalhes
        </a>
      </p>
    </div>
  `;

  // E-mail para o SOLICITANTE
  await resend.emails.send({
    from: FROM_EMAIL,
    to: criadoPor.email,
    subject: `${status.emoji} Sua solicitação foi atualizada: ${titulo}`,
    html: htmlContent,
  });

  // E-mail para o ADMIN (se não foi ele que alterou)
  if (criadoPor.email !== ADMIN_EMAIL) {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `${status.emoji} Solicitação atualizada: ${titulo}`,
      html: htmlContent,
    });
  }
}
