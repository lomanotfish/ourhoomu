import { createApp } from '../../app';
import type { AppConfig } from '../../config';
import { CoreDatabase, SessionStore } from '../../db/connection';
import { createSessions } from '../auth/session';
import { createSecrets } from '../auth/secrets';
import { fetchTrustedJwks, type IssuerAdapterOptions } from '../auth/issuer';
import { readCoreConfig, type CoreBindings } from './config';
import type { CoreData } from './data';

/** Constructors do not connect; credentials are used only on an authorized request. */
export function dataAdapter(database: CoreDatabase): CoreData {
  return {
    withPrincipal: (principal, work) => database.withPrincipal(principal, work),
  };
}
export async function createRuntimeApp(
  appConfig: AppConfig,
  bindings: CoreBindings,
  issuerTransport: Pick<IssuerAdapterOptions, 'getJwks' | 'now'> = { getJwks: fetchTrustedJwks },
) {
  try {
    const config = readCoreConfig(bindings);
    const secrets = await createSecrets(config.hmacKey, config.aesKey, config.keyVersion);
    const sessions = createSessions({
      store: new SessionStore(config.authDatabaseUrl),
      secrets,
      accessTtlSeconds: config.accessTtlSeconds,
      refreshTtlSeconds: config.refreshTtlSeconds,
      issuer: { providers: config.providers, ...issuerTransport },
    });
    return createApp(appConfig, {
      sessions,
      data: dataAdapter(new CoreDatabase(config.appDatabaseUrl)),
    });
  } catch {
    return createApp(appConfig);
  }
}
