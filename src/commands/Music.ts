import { getVoiceConnection, joinVoiceChannel } from '@discordjs/voice';
import { ActionRowBuilder, ChatInputCommandInteraction, GuildMember, SelectMenuBuilder } from 'discord.js';
import { Bot } from 'src/Bot';
import { SlashCommand, SlashCommandOption, SlashCommands } from 'src/types/CommandDecorators';
import { OnlyRoles } from './guards/Permissions';
import { BotMustBeDisconnected, MemberMustBeInSameVoiceChannel, MemberMustBeInVoiceChannel } from './guards/VoiceChannel';

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
        console.log('running play command', urlOrSearch, typeof urlOrSearch, typeof bot, typeof interaction);
        const member = interaction.member as GuildMember;
        // TODO: check if youre in the SAME channel
        if (!member?.voice?.channel) {
            return interaction.followUp('You must be in a voice channel to use this command');
        }
        let connection = getVoiceConnection(member.voice.guild.id);
        if (!connection) {
            connection = joinVoiceChannel({
                channelId: member.voice.channel.id,
                guildId: member.guild.id,
                adapterCreator: member.guild.voiceAdapterCreator,
            });
        }

        const song = await bot.musicPlayer.queue(urlOrSearch);

        if (!song || typeof song === 'string') {
            return interaction.followUp(song || 'Could not find song');
        }

        return interaction.followUp({
            content: `🎶 | Queued up **${song.title}**!`,
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
        ownerOnly: true,
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
        description: 'Set the global volume (default is 20%)',
        guards: [ OnlyRoles('Chum'), MemberMustBeInSameVoiceChannel(true) ],
    })
    public volume(
        @SlashCommandOption({
            name: 'volume',
            description: 'Volume percent (default is 20%)',
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

        joinVoiceChannel({
            channelId: member.voice.channel.id,
            guildId: member.voice.channel.guild.id,
            adapterCreator: member.voice.channel.guild.voiceAdapterCreator,
        });

        return interaction.followUp('Joined channel');
    }

    @SlashCommand({
        description: 'Leaves your voice channel',
        guards: [ OnlyRoles('Chum'), MemberMustBeInSameVoiceChannel() ],
    })
    public leave(bot: Bot, interaction: ChatInputCommandInteraction) {
        const member = interaction.member as GuildMember;
        const connection = getVoiceConnection(member.voice.guild.id);
        if (connection) {
            console.log('found connection');
            bot.musicPlayer.stop();
            connection.destroy();
        } else {
            console.log('could not find connection');
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
        console.log('Search Query:', query);

        const results = await bot.musicPlayer.search(query, 5);
        console.log(results.length + ' results');

        const selectRow = new ActionRowBuilder<SelectMenuBuilder>()
            .addComponents(new SelectMenuBuilder()
                .setCustomId('search-song-select')
                .setPlaceholder('Select song to play')
                .setOptions(results.map((song, idx) => ({
                    label: `${idx + 1}. ${(song.title || 'No title found')}`,
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
        const nowPlayingStr = nowPlaying ? `Now Playing: ${nowPlaying.title}`: '';
        const queueStr = queue.slice(0, 20).map((s, idx) => `${(idx + 1).toString().padStart(2)}. ${s.title}`).join('\n');

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