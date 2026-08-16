const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character] ?? character,
  );

export function verifyEmailTemplate(
  name: string,
  url: string,
  expiresInMinutes: number,
) {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(url);
  return {
    subject: 'Confirme seu e-mail no OmniStock',
    text: `Olá, ${name}. Confirme seu cadastro no OmniStock acessando: ${url}. O link expira em ${expiresInMinutes} minutos. Se você não solicitou este cadastro, ignore esta mensagem.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172019"><h1>OmniStock</h1><p>Olá, ${safeName}.</p><p>Seu cadastro foi realizado. Confirme seu endereço de e-mail para entrar.</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#237447;color:#fff;text-decoration:none;border-radius:8px">Confirmar meu e-mail</a></p><p>Se o botão não funcionar, copie este link:</p><p style="word-break:break-all">${safeUrl}</p><p>Este link expira em ${expiresInMinutes} minutos.</p><p>Se você não solicitou este cadastro, ignore esta mensagem.</p></div>`,
  };
}
