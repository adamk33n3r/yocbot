import { Logger as WLogger, transports } from 'winston';
import chalk from 'chalk';

const logger = new WLogger({
    transports: [
        new transports.File({
            format: {
                transform: (info, opts) => {
                    return {
                        level: info.level,
                        message: info.message,
                    };
                },
            },
        }),
        new transports.Console({
            format: {
                transform: (info, opts) => {
                    const message = info.message ?? '';

                    let meta = '';

                    if(info.meta && Object.keys(info.meta).length) {
                        meta = '\n\t' + JSON.stringify(info.meta);
                    }

                    let level = info.level.toUpperCase();

                    switch (level) {
                        case 'INFO':
                            level = chalk.cyan(level);
                            break;
                        case 'WARN':
                            level = chalk.yellow(level);
                            break;
                        case 'ERROR':
                            level = chalk.red(level);
                            break;
                    }

                    return {
                        level,
                        message: `[${info.timestamp()}][${level}] ${message}`,
                        meta,
                    };
                },
            },
        }),
    ],
});

export default logger;
