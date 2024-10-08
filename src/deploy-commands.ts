import 'reflect-metadata';
import yargs from 'yargs';
import { RESTPostAPIApplicationCommandsJSONBody, RESTPutAPIApplicationGuildCommandsResult, Routes } from 'discord.js';
import { MetadataManager } from './MetadataManager';
import { RESTWithTypes } from './RESTWithTypes';
import { clientId, guildId, token, testBot } from './local.config.json';
import { CommandLoader } from './CommandLoader';
import logger from './Logger';

const argv = yargs.options({
    testbot: { type: 'boolean', default: false },
    commands: { type: 'array', string: true, default: [] as string[] },
    clear: { type: 'boolean', default: false },
}).parseSync();

const commandLoader = new CommandLoader('commands');

if (!argv.clear) {
    if (argv.commands.length) {
        argv.commands.forEach(commandFile => commandLoader.load(commandFile));
    } else {
        commandLoader.loadAll();
    }
}

const commands: RESTPostAPIApplicationCommandsJSONBody[] = [];
for (const [_, cmdGrp] of MetadataManager.instance.slashCommandGroups) {
    logger.info(`Command name: ${cmdGrp.name}`, cmdGrp.toJSON());
    const cmdJson = cmdGrp.toJSON();
    if (Array.isArray(cmdJson)) {
        commands.push(...cmdJson);
    } else {
        commands.push(cmdJson);
    }
}

const rest = new RESTWithTypes({ version: '10' }).setToken(argv.testbot ? testBot.token : token);

rest.put<RESTPutAPIApplicationGuildCommandsResult>(Routes.applicationGuildCommands(argv.testbot ? testBot.clientId : clientId, guildId), { body: commands })
    .then(data => logger.info(`Successfully registered ${data.length} application commands.`))
    .catch(console.error);
