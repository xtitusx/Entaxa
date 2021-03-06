import 'module-alias/register';

import chalk from 'chalk';
import * as http from 'http';

import app from './app';
import { DbClientService } from './services/db-client-service';
import { DbClientType } from './models/db-client/db-client-type';
import { EnvConfig } from './utils/env-config';
import commonConfig from './config/common-config';
import dbConfig from './config/db-config';

EnvConfig.load();

const port = normalizePort(process.env.SERVER_PORT || commonConfig.server.defaultPort);
const server = http.createServer(app.set('port', port));

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);
server.on('connection', (socket) => {
    socket.setTimeout(commonConfig.server.socketTimeout);
    // 30 second timeout. Change this as you see fit.
});

process.on('SIGINT', startGracefulShutdown);
process.on('SIGTERM', startGracefulShutdown);
process.on('SIGQUIT', startGracefulShutdown);

/**
 * Fonction qui normalise/formate la valeur du port et retourne une valeur de type :
 * - number : Si val est un nombre > 0.
 * - number : Si val est une chaîne de caractères numériques > 0.
 * - string : Si val est une chaîne de caractères non numériques.
 * - boolean : false.
 * @param val
 * @returns {number | string | boolean}
 */
function normalizePort(val: number | string): number | string | boolean {
    const port: number = typeof val === 'string' ? parseInt(val, 10) : val;
    if (isNaN(port)) {
        return val;
    }
    if (port >= 0) {
        return port;
    }
    return false;
}

/**
 * Fonction qui permet la gestion des erreurs lors du lancement du serveur.
 * @param error
 */
function onError(error: NodeJS.ErrnoException): void {
    if (error.syscall !== 'listen') {
        throw error;
    }
    const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
    switch (error.code) {
        case 'EACCES':
            console.error(`${bind} requires elevated privileges`);
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(`${bind} is already in use`);
            process.exit(1);
            break;
        default:
            throw error;
    }
}

/**
 * Fonction qui permet le lancement du serveur sur une adresse et un port spécifiques et qui attend des requêtes.
 */
async function onListening(): Promise<void> {
    const addr = server.address();
    const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
    console.log('\n');
    if (process.env.NODE_ENV) {
        console.log(
            chalk.blueBright(
                `####################### ENV : ${process.env.NODE_ENV.toUpperCase()} #######################`
            )
        );
    } else {
        console.log(chalk.blueBright(`####################### ENV : ????? #######################`));
    }
    console.log('\n');
    console.log('[server] - Node server listening on ' + chalk.blueBright(bind));

    try {
        if (
            dbConfig.dbClient !== DbClientType.TYPEGOOSE && // TypeGoose non supporté par le nettoyage du cache
            commonConfig.dbClientCache.enableCleaning === true &&
            commonConfig.dbClientCache.duration
        ) {
            const sleepDuration = commonConfig.dbClientCache.duration / 2;

            while (true) {
                DbClientService.cleanDbClientCache();
                console.log(`Take a nap for ${sleepDuration} minutes 💤 💤 💤`);
                await sleep(sleepDuration);
                console.log('Time to wake up ⏰ ⏰ ⏰');
            }
        }
    } catch (err) {
        console.log(err.message);
    }
}

/**
 * Fonction qui définit un délai d'attente.
 * @param mn number : Délai en minute.
 */
function sleep(mn: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 1 * mn * 60 * 1000));
}

/**
 * Fonction qui arrête gracieusement le serveur :
 * - Reçoit une notification d'arrêt (SIGINT).
 * - Arrête de traiter de nouvelles requêtes.
 * - Finit de traiter les requêtes en cours.
 * - Libère la bases de données.
 */
function startGracefulShutdown() {
    server.close(function(err: Error) {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        DbClientService.cleanDbClientCache(true);
        console.log('Graceful Shutdown done');
        process.exit(0);
    });
}
