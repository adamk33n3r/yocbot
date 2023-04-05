import { createLogger, transports, format } from 'winston';
import chalk from 'chalk';

function getLogLevel() {
    if (process.env.LOG_LEVEL)
        return process.env.LOG_LEVEL;
    switch (process.env.NODE_ENV) {
        case 'prod':
            return 'info';
        case 'dev':
            return 'debug';
        default:
            return undefined;
    }
}

const logger = createLogger({
    transports: [
        new transports.File({
            level: getLogLevel() || 'debug',
            filename: 'main.log',
        }),
        new transports.Console({
            level: getLogLevel() || 'debug',
            format: format.combine(
                format((info, opts) => {
                    const { level, message, ...meta } = info;

                    let metaString = '';
                    if(meta[Symbol.for('splat') as any]) {
                        for (const data of meta[Symbol.for('splat') as any] as object[]) {
                            if (data instanceof Error) {
                                metaString += '\n\t' + meta.stack;
                            } else if (data.toString) {
                                if (data.toString().startsWith('[object')) {
                                    metaString += '\n\t' + JSON.stringify(data, null, 2);
                                } else {
                                    metaString += data.toString();
                                }
                            } else {
                                metaString += ' ' + data;
                            }
                        }
                    }

                    let levelString = level.toUpperCase();

                    switch (info.level.toUpperCase()) {
                        case 'DEBUG':
                            levelString = chalk.magenta(level);
                            break;
                        case 'INFO':
                            levelString = chalk.cyan(level);
                            break;
                        case 'WARN':
                            levelString = chalk.yellow(level);
                            break;
                        case 'ERROR':
                            levelString = chalk.red(level);
                            break;
                    }

                    let messageString = message;
                    if (typeof message !== 'string') {
                        messageString = JSON.stringify(message);
                    }

                    return {
                        level,
                        message: `[${levelString}] ${messageString} ${metaString}`,
                    };
                })(),
                format.timestamp(),
                format.printf((info) => {
                    return `[${info.timestamp}]${info.message}`;
                }),
            ),
        }),
    ],
});

export default logger;
