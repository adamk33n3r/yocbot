import 'reflect-metadata';
import { Bot } from './Bot';

import localConfig from './local.config.json';

console.log('Bot is starting...');

const CLIENT_ID = '564893987010248712';
const PERMISSIONS = 8; // Admin
const SCOPE = 'bot%20applications.commands';
console.log(`https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=${PERMISSIONS}&scope=${SCOPE}`);

new Bot().login(localConfig.token);
