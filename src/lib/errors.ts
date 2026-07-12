export type AppErrorKind =
  | 'configuration'
  | 'authentication'
  | 'permission'
  | 'network'
  | 'validation'
  | 'server'
  | 'unknown';

export class AppError extends Error {
  constructor(
    message: string,
    public readonly kind: AppErrorKind,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AppError';
  }
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return new AppError('Não foi possível alcançar o servidor.', 'network', { cause: error });
  }
  if (error instanceof Error) {
    if (/row-level security|permission|forbidden|not allowed/i.test(error.message)) {
      return new AppError('Você não tem permissão para esta ação.', 'permission', { cause: error });
    }
    return new AppError(error.message, 'server', { cause: error });
  }
  return new AppError('Ocorreu um erro inesperado.', 'unknown');
}
