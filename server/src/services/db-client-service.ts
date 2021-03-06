import dbConfig from '@config/db-config';
import { ErrorWrapper } from '@errors/error-wrapper';
import { StaticErrorResponse } from '@errors/static-error-response';
import { DbClient } from '@models/db-client/db-client';
import { DbClientCache } from '@models/db-client/db-client-cache';
import { DbClientFactory } from '@models/db-client/db-client-factory';
import { DbStorage } from '@models/db-storage/db-storage';
import { LoggerWrapper, LogLevel } from '@utils/logger';

type EtatNettoyage = 'DEBUT' | 'FIN';

/**
 * @class DbClientService
 */
export class DbClientService {
    private static readonly DB_CLIENT_CACHE = DbClientCache.getInstance();

    constructor() {
        // Nullary constructor
    }

    /**
     * Méthode qui nettoie le cache contenant une instance de 'DbClient'.
     * @param {boolean} [needGracefulShutdown]
     * @returns {void}
     */
    public static cleanDbClientCache(needGracefulShutdown?: boolean) {
        const logger: LoggerWrapper = new LoggerWrapper();

        DbClientService.log(logger, 'DEBUT');

        let openedDbClient: boolean;
        let deletedDbClient: boolean;

        if (!DbClientService.DB_CLIENT_CACHE.getDbClient()) {
            openedDbClient = false;
            deletedDbClient = false;
        } else if (DbClientService.DB_CLIENT_CACHE.hasExpired() || needGracefulShutdown) {
            DbClientService.DB_CLIENT_CACHE.getDbClient().closeConnection();
            DbClientService.DB_CLIENT_CACHE.setDbClient(undefined);
            openedDbClient = false;
            deletedDbClient = true;
        } else {
            openedDbClient = true;
            deletedDbClient = false;
        }

        logger.log(LogLevel.INFO, `Connexion ouverte = ${openedDbClient} / Connexion nettoyée = ${deletedDbClient}`);

        DbClientService.log(logger, 'FIN');
    }

    /**
     * Méthode qui retourne une instance mise en cache de 'DbClient'.
     * @returns {Promise<DbClient<DbStorage>>}
     * @throws {ErrorResponse.SERVICE_DBCLIENT_CONNECTION}
     */
    public getDbClient(): Promise<DbClient<DbStorage>> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!DbClientService.DB_CLIENT_CACHE.getDbClient()) {
                    DbClientService.DB_CLIENT_CACHE.setDbClient(
                        await DbClientFactory.getInstance().create(dbConfig.dbClient)
                    );
                }
                DbClientService.DB_CLIENT_CACHE.refreshLastCallDate();
                resolve(DbClientService.DB_CLIENT_CACHE.getDbClient());
            } catch (err) {
                reject(
                    err instanceof ErrorWrapper
                        ? err
                        : new ErrorWrapper(StaticErrorResponse.SERVICE_DBCLIENT_CONNECTION, err)
                );
            }
        });
    }

    /**
     * @param {LoggerWrapper} logger
     * @param {EtatNettoyage} etat
     * @returns {void}
     */
    private static log(logger: LoggerWrapper, etat: EtatNettoyage): void {
        logger.log(LogLevel.INFO, `Nettoyage du cache contenant dbClient : ${etat}`);
    }
}
