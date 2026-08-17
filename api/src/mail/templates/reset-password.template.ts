const escape = (value: string) =>
  value.replace(
    /[&<>'"]/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[
        c
      ] ?? c,
  );
export function resetPasswordTemplate(
  name: string,
  url: string,
  minutes: number,
) {
  const safeName = escape(name),
    safeUrl = escape(url);
  return {
    subject: 'Redefina sua senha no OmniStock',
    text: `Olá, ${name}. Redefina sua senha: ${url}. O link expira em ${minutes} minutos.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h1>OmniStock</h1><p>Olá, ${safeName}.</p><p>Recebemos uma solicitação para redefinir sua senha.</p><p><a href="${safeUrl}" style="padding:12px 20px;background:#237447;color:#fff;text-decoration:none">Redefinir senha</a></p><p>${safeUrl}</p><p>O link expira em ${minutes} minutos. Ignore se não solicitou.</p></div>`,
  };
}
