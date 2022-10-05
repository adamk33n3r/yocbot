import { createLogger, transports, format } from 'winston';
import chalk from 'chalk';

const logger = createLogger({
    transports: [
        new transports.File({
            filename: 'main.log',
        }),
        new transports.Console({
            format: format.combine(
                format((info, opts) => {
                    const { level, message, ...meta } = info;

                    let metaString = '';
                    if(meta && Object.keys(meta).length) {
                        metaString = '\n\t' + JSON.stringify(meta);
                    }

                    let levelString = level.toUpperCase();

                    switch (info.level.toUpperCase()) {
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
