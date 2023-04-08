import { ApplicationCommandOptionType, ChannelType } from 'discord.js';
import { MetadataManager } from 'src/MetadataManager';
import { SlashCommandGroup as SlashCommandGroupData } from 'src/SlashCommandGroup';
import { SlashCommand as SlashCommandData } from 'src/SlashCommand';
import type { SlashCommandGroupOptions } from 'src/SlashCommandGroup';
import type { SlashCommandOption, Options as BaseSlashCommandOptions } from 'src/SlashCommand';
import { MethodDecoratorEx, ParameterDecoratorEx } from './DecoratorTypes';

// export function Restricted(roles: Snowflake[] = [], users: Snowflake[] = []): ClassDecorator {
//     return setMetaData('restricted', { roles, users });
// }
// export function OwnerOnly(): ClassDecorator {
//     return setMetaData('ownerOnly', true);
// }

export const SLASH_COMMANDS: unique symbol = Symbol.for('SLASH_COMMANDS');
export const SLASH_COMMAND_OPTIONS: unique symbol = Symbol.for('SLASH_COMMAND_OPTIONS');

export const Type = Function;
export interface Type<T> extends Function {
    new(...args: any[]): T;
}
type SlashCommandOptions = Partial<Omit<BaseSlashCommandOptions, 'func'>>;
export function SlashCommand(options?: SlashCommandOptions): MethodDecoratorEx {
    return function(target: Record<string | symbol, any>, key: string, descriptor: PropertyDescriptor) {
        const name = options?.name ?? key.toLowerCase();
        if (!/^[\p{Ll}\p{Lm}\p{Lo}\p{N}\p{sc=Devanagari}\p{sc=Thai}_-]+$/u.test(name)) {
            throw new Error(`Name of command '${name}' is not valid`);
        }

        if (name == 'schedule') {
            console.log('@SlashCommand:', name, typeof target, key, descriptor);
        }

        const cmdFunc = target[key] as () => Promise<unknown>;
        const slashCommandData = new SlashCommandData({
            name,
            description: options?.description ?? name,
            adminOnly: options?.adminOnly,
            roles: options?.roles,
            users: options?.users,
            func: cmdFunc,
            guards: options?.guards,
        });

        const slashCommands = Reflect.getMetadata(SLASH_COMMANDS, target) as Map<string, SlashCommandData> || new Map();
        slashCommands.set(key, slashCommandData);
        Reflect.defineMetadata(SLASH_COMMANDS, slashCommands, target);
        return descriptor;
    };
}
export function SlashCommandGroup(options?: SlashCommandGroupOptions) {
    return function(target: any) {
        MetadataManager.instance.addSlashCommandGroup(new SlashCommandGroupData(target, options));
    };
}

function mapType(typeName: string): ApplicationCommandOptionType {
    switch (typeName) {
        case 'number':
            return ApplicationCommandOptionType.Number;
        case 'string':
            return ApplicationCommandOptionType.String;
        case 'voicechannel':
        case 'textchannel':
            return ApplicationCommandOptionType.Channel;
        case 'attachment':
            return ApplicationCommandOptionType.Attachment;
        default:
            throw new Error(`Invalid slash option type for: ${typeName}`);
    }
}

type SlashCommandOptionOptions = Omit<SlashCommandOption, 'type'> & Partial<Pick<SlashCommandOption, 'type'>>;
export function SlashCommandOption(options: SlashCommandOptionOptions): ParameterDecoratorEx {
    return function(target: Record<string|symbol, any>, propertyKey: string, parameterIndex: number) {
        if (!/^[\p{Ll}\p{Lm}\p{Lo}\p{N}\p{sc=Devanagari}\p{sc=Thai}_-]+$/u.test(options.name)) {
            throw new Error(`Name of command option '${options.name}' is not valid`);
        }
        const paramTypes = Reflect.getMetadata('design:paramtypes', target, propertyKey);
        const paramType = paramTypes[parameterIndex] as () => unknown;
        if (!options.type) {
            try {
                const mappedType = mapType(paramType.name.toLowerCase());
                options.type = mappedType;
            } catch (e) {
                console.error(`Error mapping type for: ${options.name}`);
                throw e;
            }
        }
        if (options.type === ApplicationCommandOptionType.Channel && !options.channelTypes) {
            const paramTypeName = paramType.name.toLowerCase();
            if (paramTypeName === 'voicechannel') {
                options.channelTypes = [ ChannelType.GuildVoice, ChannelType.GuildStageVoice ];
            } else if (paramTypeName === 'textchannel') {
                options.channelTypes = [ ChannelType.GuildText ];
            }
        }

        const commandOptions = Reflect.getMetadata(SLASH_COMMAND_OPTIONS, target, propertyKey) as SlashCommandOption[] || [];
        // Unshift because property decorators run in reverse
        commandOptions.unshift(options as SlashCommandOption);
        Reflect.defineMetadata(SLASH_COMMAND_OPTIONS, commandOptions, target, propertyKey);
    };
}



// function before2(beforeFunc: (bot: Bot, interaction: ChatInputCommandInteraction) => boolean, errorString: string) {
//     type Constructor<T> = new(...args: any[]) => T;
//     function Tagged<T2 extends SlashCommand, T extends Constructor<T2>>(Base: T) {
//         return class NewClass extends Base {
//             async execute(bot: Bot, interaction: ChatInputCommandInteraction): Promise<unknown> {
//                 return super.execute(bot, interaction);
//             }
//         };
//     }
//     const asdf = new (Tagged(Play));
// }

/*
function before(beforeFunc: (bot: Bot, interaction: ChatInputCommandInteraction) => boolean, errorString: string): ClassDecorator {
    // eslint-disable-next-line @typescript-eslint/ban-types
    return function<T extends Function>(target: T): T {
        const execute = Object.getOwnPropertyDescriptor(target.prototype, 'execute');
        if (!execute) {
            console.error(Object.getOwnPropertyNames(target));
            throw new Error('command is missing execute method');
        }
        const original: SlashCommand['execute'] = execute.value;
        execute.value = function (bot: Bot, interaction: ChatInputCommandInteraction) {
            logger.info('RUNNING MODIFIED EXECUTE');
            if (beforeFunc(bot, interaction)) {
                return original.call(this, bot, interaction);
            } else {
                throw new Error(errorString);
            }
        };
        Object.defineProperty(target.prototype, 'execute', execute);
        return target;
    };
}

function setMetaData(key: string, value: unknown): ClassDecorator {
    // eslint-disable-next-line @typescript-eslint/ban-types
    return function<T extends Function>(target: T): T {
        Reflect.defineMetadata(key, value, target);
        return target;
    };
}
*/
