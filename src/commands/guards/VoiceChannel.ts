import { getVoiceConnection } from '@discordjs/voice';
import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { Bot } from 'src/Bot';
import logger from 'src/Logger';

export function MemberMustBeInSameVoiceChannel(allowDisconnected: boolean = false) {
    return function (bot: Bot, interaction: ChatInputCommandInteraction): string | undefined {
        const member = interaction.member as GuildMember;
        logger.info(`${member.nickname}, ${member.guild}, ${member.guild.id}`);
        const connection = getVoiceConnection(member.guild.id);
        logger.info(`${connection}, ${connection?.joinConfig.channelId}, ${member.voice.channelId}`);
        if (allowDisconnected && !member?.voice?.channel && !connection) {
            logger.info('both member and bot are disconnected, so we are allowing the command');
            return;
        }
        if (connection && connection.joinConfig.channelId !== member.voice.channelId) {
            return 'You must be in the same voice channel as the bot to use this command';
        }
    };
}

export function MemberMustBeInVoiceChannel(bot: Bot, interaction: ChatInputCommandInteraction): string | undefined {
    const member = interaction.member as GuildMember;
    if (!member?.voice?.channel) {
        return 'You must be in a voice channel to use this command';
    }
}

export function BotMustBeDisconnected(bot: Bot, interaction: ChatInputCommandInteraction): string | undefined {
    const member = interaction.member as GuildMember;
    const connection = getVoiceConnection(member.guild.id);
    if (connection) {
        return 'Bot is already in a channel';
    }
}

