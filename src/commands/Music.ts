import { getVoiceConnection, joinVoiceChannel } from '@discordjs/voice';
import { ActionRowBuilder, ChatInputCommandInteraction, GuildMember, SelectMenuBuilder } from 'discord.js';
import { Bot } from 'src/Bot';
import { SlashCommand, SlashCommandOption, SlashCommands } from 'src/types/CommandDecorators';
import { OnlyRoles } from './guards/Permissions';
import { BotMustBeDisconnected, MemberMustBeInSameVoiceChannel, MemberMustBeInVoiceChannel } from './guards/VoiceChannel';
import logger from '../Logger';

@SlashCommands()
export abstract class MusicCommands {
    @SlashCommand({
        description: 'Play a song in your channel',
        guards: [ OnlyRoles('Chum'), MemberMustBeInVoiceChannel, MemberMustBeInSameVoiceChannel() ],
    })
    public async play(
        @SlashCommandOption({ name: 'query', description: 'YouTube URL or search terms', required: true })
        urlOrSearch: string,
        bot: Bot,
        interaction: ChatInputCommandInteraction,
    ): Promise<unknown> {
        logger.info(`running play command: ${urlOrSearch}`);
        const member = interaction.member as GuildMember;
        // TODO: check if youre in the SAME channel
        if (!member?.voice?.channel) {
            return interaction.followUp('You must be in a voice channel to use this command');
        }
        const connection = getVoiceConnection(member.voice.guild.id);
        if (!connection) {
            bot.joinVoiceChannel(member.voice.channel);
        }

        const song = await bot.musicPlayer.queue(urlOrSearch);

        if (!song || typeof song === 'string') {
            return interaction.followUp(song || 'Could not find song');
        }

        return interaction.followUp({
            content: song.length === 1 ? `🎶 | Queued up **${song[0].title} (${song[0].durationRaw})**!` : `🎶 | Queued up **${song.length} songs**!`,
            ephemeral: false,
        });
    }

    @SlashCommand({
        description: 'Pauses or unpauses the music',
        guards: [ OnlyRoles('Chum') ],
    })
    public pause(bot: Bot, interaction: ChatInputCommandInteraction) {
        const paused = bot.musicPlayer.togglePause();

        return interaction.followUp(paused ? 'Paused' : 'Unpaused');
    }

    @SlashCommand({
        description: 'Stops playing music and clears the queue',
        adminOnly: true,
        guards: [ OnlyRoles('Chum'), MemberMustBeInSameVoiceChannel() ],
    })
    public stop(bot: Bot, interaction: ChatInputCommandInteraction) {
        bot.musicPlayer.stop();

        return interaction.followUp('Stopped');
    }

    @SlashCommand({
        description: 'Skips the current song',
        guards: [ OnlyRoles('Chum'), MemberMustBeInSameVoiceChannel() ],
    })
    public skip(bot: Bot, interaction: ChatInputCommandInteraction) {
        bot.musicPlayer.skip();

        return interaction.followUp('Skipped');
    }

    @SlashCommand({
        description: 'Clears the queue',
        roles: [ 'Chum' ],
        guards: [ OnlyRoles('Chum') ],
    })
    public clear(bot: Bot, interaction: ChatInputCommandInteraction) {
        bot.musicPlayer.clearQueue();

        return interaction.followUp('Queue cleared');
    }

    @SlashCommand({
        description: 'Set the global volume (default is 10%)',
        guards: [ OnlyRoles('Chum'), MemberMustBeInSameVoiceChannel(true) ],
    })
    public volume(
        @SlashCommandOption({
            name: 'volume',
            description: 'Volume percent (default is 10%)',
            minValue: 0,
            maxValue: 100,
        })
        volume: number,
        bot: Bot,
        interaction: ChatInputCommandInteraction,
    ) {
        if (volume === undefined) {
            return interaction.followUp(`Volume is set to ${bot.musicPlayer.volume * 100 * 2}%`);
        }
        if (volume < 0 || volume > 100) {
            return interaction.followUp(`Volume of ${volume} is not valid`);
        }
        bot.musicPlayer.volume = volume / 2 / 100;

        return interaction.followUp(`Set volume to ${volume}`);
    }

    @SlashCommand({
        description: 'Join your voice channel',
        guards: [ OnlyRoles('Chum'), MemberMustBeInVoiceChannel, BotMustBeDisconnected ],
    })
    public join(bot: Bot, interaction: ChatInputCommandInteraction) {
        const member = interaction.member as GuildMember;
        if (!member?.voice?.channel) {
            return interaction.followUp('You must be in a voice channel to use this command');
        }

        bot.joinVoiceChannel(member.voice.channel);

        return interaction.followUp('Joined channel');
    }

    @SlashCommand({
        description: 'Leaves your voice channel',
        guards: [ OnlyRoles('Chum'), MemberMustBeInSameVoiceChannel() ],
    })
    public leave(bot: Bot, interaction: ChatInputCommandInteraction) {
        const member = interaction.member as GuildMember;
        if (bot.leaveVoiceChannel(member.guild.id)) {
            bot.musicPlayer.stop();
        }

        return interaction.followUp('Left channel');
    }

    @SlashCommand({
        description: 'Searches for a song and shows results',
        guards: [ OnlyRoles('Chum'), MemberMustBeInSameVoiceChannel() ],
    })
    public async search(
        @SlashCommandOption({ name: 'query', description: 'Search terms', required: true })
        query: string,
        bot: Bot,
        interaction: ChatInputCommandInteraction,
    ) {
        logger.info(`Search Query: ${query}`);

        const results = await bot.musicPlayer.search(query, 5);
        logger.info(results.length + ' results');

        const selectRow = new ActionRowBuilder<SelectMenuBuilder>()
            .addComponents(new SelectMenuBuilder()
                .setCustomId('search-song-select')
                .setPlaceholder('Select song to play')
                .setOptions(results.map((song, idx) => ({
                    label: `${idx + 1}. ${song.live ? '🔴 ' : `(${song.durationRaw}) `}${(song.title || 'No title found')}`.substring(0, 100),
                    description: song.channel ? `${song.channel.name} ${song.channel.artist ? '🎵' : ''}` : 'No channel name found',
                    value: song.url || '',
                }))),
            );

        return interaction.followUp({
            content: 'Showing top 5 results...',
            components: [ selectRow ],
        });
    }

    @SlashCommand({
        description: 'Displays the current queue',
    })
    public queue(
        bot: Bot,
        interaction: ChatInputCommandInteraction,
    ) {
        const nowPlaying = bot.musicPlayer.getNowPlaying();
        const queue = bot.musicPlayer.getQueue();
        if (!nowPlaying && queue.length === 0) {
            return interaction.followUp('Nothing in queue');
        }
        const nowPlayingStr = nowPlaying ? `Now Playing: ${nowPlaying.title} - ${nowPlaying.channel?.name}`: '';
        const queueStr = queue.slice(0, 20).map((s, idx) => `${(idx + 1).toString().padStart(2)}. ${s.title} - ${s.channel?.name}`).join('\n');

        return interaction.followUp({
            content: `\`\`\`${nowPlayingStr}\n${queueStr}\`\`\``,
        });
    }

    @SlashCommand({
        description: 'Displays info on the current song',
    })
    public nowPlaying(bot: Bot, interaction: ChatInputCommandInteraction) {
        const nowPlaying = bot.musicPlayer.getNowPlaying();
        if (!nowPlaying) {
            return interaction.followUp('Not currently playing anything');
        }

        return interaction.followUp(`${nowPlaying.title}\n${nowPlaying.url}`);
    }
}
