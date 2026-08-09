export const SUPABASE_PROJECT_REF = 'ezsylcmnqbcwvkoqybkd';
export const DEFAULT_ISSUER_UI_ORIGIN = 'http://localhost:5173';
export const DEFAULT_WALLET_UI_ORIGIN = 'http://localhost:3002';
export const PASSPORT_HMAC_SECRET_DOCUMENTATION_PLACEHOLDER =
  'replace_with_at_least_32_random_characters';

export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  SUPABASE_PROJECT_REF: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  PASSPORT_HMAC_SECRET: string;
  ISSUER_UI_ORIGIN: string;
  WALLET_UI_ORIGIN: string;
  PASSWORD_RESET_REDIRECT_URL?: string;
}

function requireNonEmptyString(
  config: Record<string, unknown>,
  key: keyof EnvironmentVariables,
): string {
  const value = config[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }

  return value.trim();
}

function validateBrowserOrigin(
  config: Record<string, unknown>,
  key: 'ISSUER_UI_ORIGIN' | 'WALLET_UI_ORIGIN',
  nodeEnv: EnvironmentVariables['NODE_ENV'],
  developmentDefault: string,
): string {
  const configuredValue = config[key];
  const rawValue =
    configuredValue === undefined ||
    configuredValue === null ||
    configuredValue === ''
      ? nodeEnv === 'production'
        ? undefined
        : developmentDefault
      : configuredValue;

  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    throw new Error(`${key} is required`);
  }

  let url: URL;

  try {
    url = new URL(rawValue.trim());
  } catch {
    throw new Error(`${key} must be a valid HTTP(S) origin`);
  }

  const hasUnsupportedComponents =
    url.protocol !== 'http:' && url.protocol !== 'https:';
  const isNotAnOriginOnlyUrl =
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.pathname !== '/' ||
    url.search.length > 0 ||
    url.hash.length > 0;

  if (hasUnsupportedComponents || isNotAnOriginOnlyUrl) {
    throw new Error(`${key} must be a valid HTTP(S) origin without a path`);
  }

  return url.origin;
}

export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables & Record<string, unknown> {
  const nodeEnv =
    config.NODE_ENV === 'test' || config.NODE_ENV === 'production'
      ? config.NODE_ENV
      : 'development';
  const projectRef = requireNonEmptyString(config, 'SUPABASE_PROJECT_REF');

  if (projectRef !== SUPABASE_PROJECT_REF) {
    throw new Error(
      `SUPABASE_PROJECT_REF must be the locked development project ${SUPABASE_PROJECT_REF}`,
    );
  }

  const rawUrl = requireNonEmptyString(config, 'SUPABASE_URL');
  const url = new URL(rawUrl);
  const expectedHostname = `${SUPABASE_PROJECT_REF}.supabase.co`;

  if (url.protocol !== 'https:' || url.hostname !== expectedHostname) {
    throw new Error(
      `SUPABASE_URL must be https://${expectedHostname} for the locked development project`,
    );
  }

  const secretKey = requireNonEmptyString(config, 'SUPABASE_SECRET_KEY');
  const publishableKey = requireNonEmptyString(
    config,
    'SUPABASE_PUBLISHABLE_KEY',
  );
  const passportHmacSecret = requireNonEmptyString(
    config,
    'PASSPORT_HMAC_SECRET',
  );

  if (!secretKey.startsWith('sb_secret_')) {
    throw new Error(
      'SUPABASE_SECRET_KEY must be a modern Supabase sb_secret_... backend key',
    );
  }

  if (!publishableKey.startsWith('sb_publishable_')) {
    throw new Error(
      'SUPABASE_PUBLISHABLE_KEY must be a modern Supabase sb_publishable_... key',
    );
  }

  if (passportHmacSecret === PASSPORT_HMAC_SECRET_DOCUMENTATION_PLACEHOLDER) {
    throw new Error(
      'PASSPORT_HMAC_SECRET must not use the documentation placeholder',
    );
  }

  if (Buffer.byteLength(passportHmacSecret, 'utf8') < 32) {
    throw new Error('PASSPORT_HMAC_SECRET must be at least 32 bytes');
  }

  const port = Number(config.PORT ?? 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const optionalUrl = (key: keyof EnvironmentVariables): string | undefined => {
    const rawValue = config[key];

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return undefined;
    }

    if (typeof rawValue !== 'string') {
      throw new Error(`${key} must be a valid URL`);
    }

    try {
      return new URL(rawValue.trim()).toString();
    } catch {
      throw new Error(`${key} must be a valid URL`);
    }
  };

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: port,
    SUPABASE_PROJECT_REF: projectRef,
    SUPABASE_URL: url.origin,
    SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SECRET_KEY: secretKey,
    PASSPORT_HMAC_SECRET: passportHmacSecret,
    ISSUER_UI_ORIGIN: validateBrowserOrigin(
      config,
      'ISSUER_UI_ORIGIN',
      nodeEnv,
      DEFAULT_ISSUER_UI_ORIGIN,
    ),
    WALLET_UI_ORIGIN: validateBrowserOrigin(
      config,
      'WALLET_UI_ORIGIN',
      nodeEnv,
      DEFAULT_WALLET_UI_ORIGIN,
    ),
    PASSWORD_RESET_REDIRECT_URL: optionalUrl('PASSWORD_RESET_REDIRECT_URL'),
  };
}
