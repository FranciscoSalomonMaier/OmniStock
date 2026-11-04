export const connectionUnavailableMessage =
  'Não foi possível concluir a conexão. Tente novamente. Se o problema persistir, entre em contato com o suporte e informe o código de atendimento.';

export function publicConnectionError(code: string | null) {
  if (
    ['REAUTH_REQUIRED', 'TOKEN_EXPIRED', 'RECONNECT_REQUIRED'].includes(
      code ?? '',
    )
  )
    return {
      code: 'RECONNECT_REQUIRED',
      message:
        'Sua conta precisa ser reconectada. Inicie uma nova conexão pelas integrações.',
    };
  if (code === 'MERCADO_LIVRE_AUTHORIZATION_DENIED')
    return {
      code: 'AUTHORIZATION_CANCELLED',
      message:
        'A autorização foi cancelada ou negada. Tente conectar novamente.',
    };
  if (code === 'MERCADO_LIVRE_INVALID_STATE')
    return {
      code: 'AUTHORIZATION_EXPIRED',
      message:
        'A tentativa de conexão expirou ou já foi utilizada. Inicie uma nova conexão pelas integrações.',
    };
  return {
    code: 'CONNECTION_UNAVAILABLE',
    message: connectionUnavailableMessage,
  };
}

export function publicConnectionLastError(
  at: Date,
  code: string | null,
  storedMessage: string | null,
) {
  const diagnosticId = storedMessage?.match(
    /(?:Diagnóstico|Código de atendimento): ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  )?.[1];
  const error = publicConnectionError(code);
  return {
    at,
    ...error,
    ...(diagnosticId
      ? {
          diagnosticId,
          message: `${error.message} Código de atendimento: ${diagnosticId}.`,
        }
      : {}),
  };
}
