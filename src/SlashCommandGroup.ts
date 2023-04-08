import { RESTPostAPIApplicationCommandsJSONBody, SlashCommandBuilder } from 'discord.js';
import { SlashCommand, SlashCommandOption } from './SlashCommand';
import { SLASH_COMMANDS, SLASH_COMMAND_OPTIONS } from './types/CommandDecorators';

export interface SlashCommandGroupOptions {
    name: string;
    description: string;
}

export class SlashCommandGroup {
    public get name(): string | undefined {
        return this.options?.name;
    }
    public get commands(): SlashCommand[] {
        return this.slashCommands.slice();
    }
    private slashCommands: SlashCommand[] = [];

    constructor(private target: any, private options?: SlashCommandGroupOptions) {
        const slashCommands = Reflect.getMetadata(SLASH_COMMANDS, target.prototype) as Map<string, SlashCommand>;
        for (const [propKey, slashCommand] of slashCommands) {
            if (options) {
                slashCommand.parent = this;
            }
            this.slashCommands.push(slashCommand);

            for (const opt of Reflect.getMetadata(SLASH_COMMAND_OPTIONS, target.prototype, propKey) as SlashCommandOption[] || []) {
                slashCommand.addOption(opt);
            }
        }
    }

    public toJSON(): RESTPostAPIApplicationCommandsJSONBody | RESTPostAPIApplicationCommandsJSONBody[] {
        // Is subcommand
        if (this.options) {
            const builder = new SlashCommandBuilder()
                .setName(this.options.name)
                .setDescription(this.options.description);

            for (const slashCommand of this.slashCommands) {
                builder.addSubcommand(slashCommand.asSubcommand());
            }

            return builder.toJSON();
        } else {
            return this.slashCommands.map(slashCommand => slashCommand.asCommand().toJSON());
        }
    }
}
