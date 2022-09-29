import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { Bot } from 'src/Bot';

export function OnlyRoles(...roles: string[]) {
    if (roles.length === 0) {
        throw new Error('Must supply at least one role to the OnlyRoles guard');
    }

    return function (bot: Bot, interaction: ChatInputCommandInteraction): string | undefined {
        const member = interaction.member as GuildMember;
        if (!roles.some(r => member.roles.cache.find(gr => gr.name === r))) {
            return 'You do not have permission to use this command';
        }
    };
}
