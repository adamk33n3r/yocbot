import { Collection, RESTPostAPIApplicationCommandsJSONBody, SlashCommandBuilder } from 'discord.js';
import { SlashCommand, SlashCommandOption } from './SlashCommand';
import { SLASH_COMMANDS, SLASH_COMMAND_OPTIONS } from './types/CommandDecorators';

export interface SlashCommandGroupOptions {
    name: string;
    description: string;
}

export type SlashCommandCollection = Collection<string, SlashCommand>

export class SlashCommandGroup {
    public get name(): string {
        return this.options?.name ?? this.target.name;
    }
    public get className(): string {
        return this.target.name;
    }
    public get commands(): SlashCommandCollection {
        return new Collection(this.slashCommands);
    }
    private slashCommands: SlashCommandCollection = new Collection();

    constructor(private target: any, private options?: SlashCommandGroupOptions) {
        const slashCommands = Reflect.getMetadata(SLASH_COMMANDS, target.prototype) as Map<string, SlashCommand>;
        for (const [propKey, slashCommand] of slashCommands) {
            slashCommand.parent = this;
            if (options) {
                slashCommand.isSubCommand = true;
            }
            this.slashCommands.set(slashCommand.fullName, slashCommand);

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

            for (const [_, slashCommand] of this.slashCommands) {
                builder.addSubcommand(slashCommand.asSubcommand());
            }

            return builder.toJSON();
        } else {
            return this.slashCommands.map(slashCommand => slashCommand.asCommand().toJSON());
        }
    }
}
