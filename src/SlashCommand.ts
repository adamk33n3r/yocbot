import { ApplicationCommandOptionAllowedChannelTypes, ApplicationCommandOptionType, ChatInputCommandInteraction, RESTPostAPIApplicationCommandsJSONBody, SlashCommandAttachmentOption, SlashCommandBuilder, SlashCommandChannelOption, SlashCommandNumberOption, SlashCommandStringOption } from 'discord.js';
import { Bot } from './Bot';
import logger from './Logger';

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
}

export class SlashCommand {
    // ownerOnly: boolean = false;
    // sameVoiceChannel: boolean = false;
    // restricted: { roles: string[], users: string[] } = { roles: [], users: [] };
    // data?: RESTPostAPIApplicationCommandsJSONBody;

    private options: SlashCommandOption[] = [];

    public get name() {
        return this.slashCommandOptions.name;
    }

    public get roles() {
        return this.slashCommandOptions.roles?.slice();
    }

    public get users() {
        return this.slashCommandOptions.users?.slice();
    }

    public execute(bot: Bot, interaction: ChatInputCommandInteraction) {
        // interaction.options.
        // this.slashCommandOptions.funcParams.map(fp => {
        //     if (fp === Bot)
        // });
        logger.debug(this.options);
        logger.debug(this.parseParams(interaction));
        logger.debug(this.slashCommandOptions.guards?.length);
        for (const guard of this.slashCommandOptions.guards || []) {
            const failed = guard(bot, interaction);
            if (failed) {
                console.warn('guard failed:', guard.name, failed);
                return interaction.followUp(failed);
            }
        }
        return this.slashCommandOptions.func.call(null, ...this.parseParams(interaction), bot, interaction);
    }

    constructor(private slashCommandOptions: Options) { }

    public addOption(option: SlashCommandOption) {
        this.options.push(option);
    }

    public toJSON(): RESTPostAPIApplicationCommandsJSONBody {
        const builder = new SlashCommandBuilder()
            .setName(this.slashCommandOptions.name)
            .setDescription(this.slashCommandOptions.description);

        if (this.slashCommandOptions.adminOnly) {
            builder.setDefaultMemberPermissions(0);
        }

        this.options.forEach(opt => {
            switch (opt.type) {
                case ApplicationCommandOptionType.String:
                    builder.addStringOption(new SlashCommandStringOption().setName(opt.name).setDescription(opt.description).setRequired(opt.required ?? false));
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
            }
        });
        return builder.toJSON();
    }

    private parseParams(interaction: ChatInputCommandInteraction) {
        return this.options.map((opt) => {
            switch (opt.type) {
                case ApplicationCommandOptionType.String:
                    return interaction.options.getString(opt.name) ?? undefined;
                case ApplicationCommandOptionType.Number:
                    return interaction.options.getNumber(opt.name) ?? undefined;
                case ApplicationCommandOptionType.Channel:
                    return interaction.options.getChannel(opt.name) ?? undefined;
                case ApplicationCommandOptionType.Attachment:
                    return interaction.options.getAttachment(opt.name) ?? undefined;
                default:
                    logger.error(`Unhandled command option type ${opt.type}`);
                    break;
            }
        });
    }
}
