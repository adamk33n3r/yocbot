import {
    ApplicationCommandOptionAllowedChannelTypes,
    ApplicationCommandOptionType,
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    RESTPostAPIApplicationCommandsJSONBody,
    SharedSlashCommandOptions,
    SlashCommandAttachmentOption,
    SlashCommandBuilder,
    SlashCommandChannelOption,
    SlashCommandNumberOption,
    SlashCommandRoleOption,
    SlashCommandStringOption,
    SlashCommandSubcommandBuilder,
    ToAPIApplicationCommandOptions,
} from 'discord.js';
import { Bot } from './Bot';
import logger from './Logger';
import { SlashCommandGroup } from './SlashCommandGroup';

type GuardPredicate = (bot: Bot, interaction: ChatInputCommandInteraction) => string | undefined;

export interface Options {
    func: (...params: any[]) => Promise<unknown>;
    name: string;
    description: string;
    adminOnly?: boolean;
    roles?: string[];
    users?: string[];
    guards?: GuardPredicate[];
}

export interface SlashCommandOption {
    name: string;
    description: string;
    type: ApplicationCommandOptionType;
    minValue?: number;
    maxValue?: number;
    channelTypes?: ApplicationCommandOptionAllowedChannelTypes[];
    required?: boolean;
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

export class SlashCommand {
    private _group: SlashCommandGroup | undefined;

    private options: SlashCommandOption[] = [];

    public get name() {
        return this.slashCommandOptions.name;
    }

    public get fullName(): string {
        return this._group ? `${this._group.name}:${this.name}` : this.name;
    }

    public get parent(): SlashCommandGroup | undefined {
        return this._group;
    }
    public set parent(val: SlashCommandGroup | undefined) {
        this._group = val;
    }

    public get roles() {
        return this.slashCommandOptions.roles?.slice();
    }

    public get users() {
        return this.slashCommandOptions.users?.slice();
    }

    public async execute(bot: Bot, interaction: ChatInputCommandInteraction) {
        logger.debug(this.options);
        logger.debug(this.parseParams(interaction));
        logger.debug(this.slashCommandOptions.guards?.length ?? 'no guards');
        for (const guard of this.slashCommandOptions.guards || []) {
            const failed = guard(bot, interaction);
            if (failed) {
                console.warn('guard failed:', guard.name, failed);
                return interaction.followUp(failed);
            }
        }
        return this.slashCommandOptions.func.call(null, ...this.parseParams(interaction), bot, interaction);
    }

    public async autocomplete(bot: Bot, interaction: AutocompleteInteraction): Promise<unknown> {
        const focusedOption = interaction.options.getFocused(true);
        const opt = this.options.find(opt => opt.name == focusedOption.name);
        if (!opt || !opt.autocomplete) {
            return;
        }

        return opt.autocomplete(interaction);
    }

    constructor(private slashCommandOptions: Options) { }

    public addOption(option: SlashCommandOption) {
        this.options.push(option);
    }

    public asSubcommand(): SlashCommandSubcommandBuilder {
        const builder = new SlashCommandSubcommandBuilder()
            .setName(this.slashCommandOptions.name)
            .setDescription(this.slashCommandOptions.description);

        this.addOptionsToBuilder(builder);

        return builder;
    }

    public asCommand(): SlashCommandBuilder {
        const builder = new SlashCommandBuilder()
            .setName(this.slashCommandOptions.name)
            .setDescription(this.slashCommandOptions.description);

        if (this.slashCommandOptions.adminOnly) {
            builder.setDefaultMemberPermissions(0);
        }

        this.addOptionsToBuilder(builder);

        return builder;
    }

    private addOptionsToBuilder(builder: SharedSlashCommandOptions) {
        this.options.forEach(opt => {
            switch (opt.type) {
                case ApplicationCommandOptionType.String:
                    builder.addStringOption(new SlashCommandStringOption().setName(opt.name).setDescription(opt.description).setRequired(opt.required ?? false).setAutocomplete(!!opt.autocomplete));
                    break;
                case ApplicationCommandOptionType.Number: {
                    const numOpt = new SlashCommandNumberOption().setName(opt.name).setDescription(opt.description).setRequired(opt.required ?? false);
                    if (opt.minValue) {
                        numOpt.setMinValue(opt.minValue);
                    }
                    if (opt.maxValue) {
                        numOpt.setMaxValue(opt.maxValue);
                    }
                    builder.addNumberOption(numOpt);
                    break;
                }
                case ApplicationCommandOptionType.Channel:
                    builder.addChannelOption(new SlashCommandChannelOption().setName(opt.name).setDescription(opt.description).setRequired(opt.required ?? false).addChannelTypes(...opt.channelTypes ?? []));
                    break;
                case ApplicationCommandOptionType.Attachment:
                    builder.addAttachmentOption(new SlashCommandAttachmentOption().setName(opt.name).setDescription(opt.description).setRequired(opt.required ?? false));
                    break;
                case ApplicationCommandOptionType.Role:
                    builder.addRoleOption(new SlashCommandRoleOption().setName(opt.name).setDescription(opt.description).setRequired(opt.required ?? false));
                    break;
            }
        });
    }

    private parseParams(interaction: ChatInputCommandInteraction) {
        return this.options.map((opt) => {
            switch (opt.type) {
                case ApplicationCommandOptionType.String:
                    return interaction.options.getString(opt.name) || undefined;
                case ApplicationCommandOptionType.Number:
                    return interaction.options.getNumber(opt.name) || undefined;
                case ApplicationCommandOptionType.Channel:
                    return interaction.options.getChannel(opt.name) || undefined;
                case ApplicationCommandOptionType.Attachment:
                    return interaction.options.getAttachment(opt.name) || undefined;
                case ApplicationCommandOptionType.Role:
                    return interaction.options.getRole(opt.name) || undefined;
                default:
                    logger.error(`Unhandled command option type ${opt.type}`);
                    break;
            }
        });
    }
}
