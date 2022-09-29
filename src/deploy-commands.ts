import 'reflect-metadata'
import { RESTPutAPIApplicationGuildCommandsResult, Routes } from 'discord.js';
import { MetadataManager } from './MetadataManager';
import { RESTWithTypes } from './RESTWithTypes';
import { clientId, guildId, token } from './local.config.json';
import { CommandLoader } from './CommandLoader';

const commandLoader = new CommandLoader('commands');
commandLoader.loadAll();

const commands = MetadataManager.instance.slashCommands;
for (const cmd of commands) {
    console.log('Command name:', cmd.name);
    // console.log(cmd.toJSON());
}

const rest = new RESTWithTypes({ version: '10' }).setToken(token);

rest.put<RESTPutAPIApplicationGuildCommandsResult>(Routes.applicationGuildCommands(clientId, guildId), { body: commands.map(cmd => cmd.toJSON()) })
    .then(data => console.log(`Successfully registered ${data.length} application commands.`))//, data))
    .catch(console.error);
