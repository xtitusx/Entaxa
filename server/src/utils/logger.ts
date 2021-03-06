import * as httpContext from 'express-http-context';
import * as winston from 'winston';

import commonConfig from '@config/common-config';

/** Npm logging levels
 * @readonly
 * @enum {string}
 */
export enum LogLevel {
    ERROR = 'error',
    WARN = 'warn',
    INFO = 'info',
    VERBOSE = 'verbose',
    DEBUG = 'debug',
    SILLY = 'silly',
}

/**
 * Un singleton 'Winston' :
 * - Format : timestamp level [label]: message
 * - Output : Console
 * @class Logger
 */
export class Logger {
    private static INSTANCE: Logger;

    private winston: winston.Logger;

    private constructor() {
        this.winston = winston.createLogger({
            level: process.env.NODE_ENV === 'development' ? 'silly' : 'info',
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple(),
                winston.format.timestamp({}),
                winston.format.printf((info) => `${info.timestamp} ${info.level} ${info.message}`)
            ),
            transports: [new winston.transports.Console()],
            silent: process.env.MOCHA_TEST === '1' ? true : false,
        });
    }

    public static getInstance(): winston.Logger {
        if (!Logger.INSTANCE) {
            Logger.INSTANCE = new Logger();
        }

        return Logger.INSTANCE.winston;
    }
}

/**
 * @class LoggerWrapper
 */
export class LoggerWrapper {
    public constructor() {
        // Nullary constructor
    }

    /**
     * @summary timestamp logLevel requestUid methodCallerName (methodCallerName file location) - message
     * @param {LogLevel} logLevel
     * @param {string} message
     * @returns {void}
     */
    public log(logLevel: LogLevel, message: string): void {
        Logger.getInstance().log(
            logLevel,
            `${httpContext.get(commonConfig.request.httpContext)} ${this.getMethodCallerName()} - ${message}`
        );
    }

    private getMethodCallerName(): string {
        const stackTrace: Array<string> = new Error().stack.split('at ');

        return stackTrace[3]
            .trim()
            .replace(/[(].*build\//g, '(')
            .replace(/^(\w*_1\.)/, '');
    }
}
