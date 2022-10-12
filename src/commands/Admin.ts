import { ChannelType, ChatInputCommandInteraction, GuildMember, VoiceChannel } from 'discord.js';
import { Bot } from 'src/Bot';
import logger from 'src/Logger';
import { SlashCommand, SlashCommandOption, SlashCommands } from 'src/types/CommandDecorators';

@SlashCommands()
export abstract class AdminCommands {
    @SlashCommand({
        description: 'Move all members in your voice channel to the specified channel',
        adminOnly: true,
    })
    public async moveAll(
        @SlashCommandOption({
            name: 'channel',
            description: 'Channel to move to',
            required: true,
            channelTypes: [ ChannelType.GuildVoice, ChannelType.GuildStageVoice ],
        })
        channel: VoiceChannel,
        bot: Bot,
        interaction: ChatInputCommandInteraction,
    ) {
        logger.debug('moveAll command', channel);
        const member = interaction.member as GuildMember;
        logger.debug('member voice channel', member.voice.channel);
        if (!member?.voice?.channel) {
            return interaction.followUp('You must be in a voice channel to use this command');
        }

        await Promise.all(member.voice.channel.members.map(vMem => {
            logger.debug(`running setChannel for ${vMem.nickname}`, { vMem, channel });
            return vMem.voice.setChannel(channel.id);
        }).filter(m => m));

        return interaction.followUp('All Moved');
    }
}
