import 'reflect-metadata';
import yargs from 'yargs';
import { Bot } from './Bot';
import logger from './Logger';

import localConfig from './local.config.json';

const argv = yargs.options({
    testbot: { type: 'boolean', default: false },
}).parseSync();

logger.info('Bot is starting...');

const PERMISSIONS = 8; // Admin
const SCOPE = 'bot%20applications.commands';

if (argv.testbot) {
    process.env.GCLOUD_PROJECT = 'ye-olde-chums';
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    logger.info(`https://discord.com/api/oauth2/authorize?client_id=${localConfig.testBot.clientId}&permissions=${PERMISSIONS}&scope=${SCOPE}`);
    new Bot(!argv.testbot).login(localConfig.testBot.token);
} else {
    logger.info(`https://discord.com/api/oauth2/authorize?client_id=${localConfig.clientId}&permissions=${PERMISSIONS}&scope=${SCOPE}`);
    new Bot(argv.testbot).login(localConfig.token);
}

