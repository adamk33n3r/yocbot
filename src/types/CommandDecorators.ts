import { getVoiceConnection } from '@discordjs/voice';
import { ApplicationCommandOptionType, CacheType, ChatInputCommandInteraction, GuildMember, Snowflake } from 'discord.js';
import { Bot } from 'src/Bot';
import { MetadataManager } from 'src/MetadataManager';
import { Options as BaseSlashCommandOptions, SlashCommand as SlashCommandData, SlashCommandOption } from 'src/SlashCommand';
import { ClassDecoratorEx, MethodDecoratorEx, ParameterDecoratorEx } from './DecoratorTypes';

// export function Restricted(roles: Snowflake[] = [], users: Snowflake[] = []): ClassDecorator {
//     return setMetaData('restricted', { roles, users });
// }
// export function OwnerOnly(): ClassDecorator {
//     return setMetaData('ownerOnly', true);
// }

export function SlashCommands(): ClassDecoratorEx {
    // logger.info('slashCommands decorator parent');
    return function(target: Record<string, unknown>) {
        // logger.info('slashCommands decorator');
    };
}

export const Type = Function;
export interface Type<T> extends Function {
    new(...args: any[]): T;
}
type SlashCommandOptions = Partial<Omit<BaseSlashCommandOptions, 'func'>>;
export function SlashCommand(options?: SlashCommandOptions): MethodDecoratorEx {
    return function(target: Record<string, () => Promise<unknown>>, key: string, descriptor: PropertyDescriptor) {
        const name = (options?.name ?? key.toString()).toLowerCase();
        if (!/^[\p{Ll}\p{Lm}\p{Lo}\p{N}\p{sc=Devanagari}\p{sc=Thai}_-]+$/u.test(name)) {
            throw new Error(`Name of command '${name}' is not valid`);
        }
        // const cmdFunc = (target as Record<string | symbol, () => Promise<unknown>>)[key];
        const paramTypes = Reflect.getMetadata('design:paramtypes', target, key) as (Type<unknown>)[];
        paramTypes.filter(t => !(t === Bot || t === ChatInputCommandInteraction));
        const mappedTypes = paramTypes.map((t) => {
            if (t === Bot) {
                return Bot;
            } else if (t === ChatInputCommandInteraction) {
                return ChatInputCommandInteraction;
            }

            return { type: mapType(t.name.toLowerCase()) };
        });

        const cmdFunc = target[key];
        MetadataManager.instance.addSlashCommand(target, key, new SlashCommandData({
            name: name,
            description: options?.description ?? name,
            ownerOnly: options?.ownerOnly,
            roles: options?.roles,
            users: options?.users,
            func: cmdFunc,
            guards: options?.guards,
            // funcParams: mappedTypes,
        }));
        return descriptor;
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
        default:
            throw new Error(`Invalid slash option type: ${typeName}`)
    }
}

type SlashCommandOptionOptions = Omit<SlashCommandOption, 'type'> & Partial<Pick<SlashCommandOption, 'type'>>;
export function SlashCommandOption(options: SlashCommandOptionOptions): ParameterDecoratorEx {
    return function(target: Record<string, unknown>, propertyKey: string, parameterIndex: number) {
        if (!options.type) {
            const paramTypes = Reflect.getMetadata('design:paramtypes', target, propertyKey);
            const paramType = paramTypes[parameterIndex] as () => unknown;
            const mappedType = mapType(paramType.name.toLowerCase());
            options.type = mappedType;
        }

        MetadataManager.instance.addSlashCommandOption(target, propertyKey, options as SlashCommandOption);
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
