import { AudioPlayer, AudioPlayerStatus, createAudioPlayer, createAudioResource, getVoiceConnection, NoSubscriberBehavior } from '@discordjs/voice';
import { EmbedBuilder } from 'discord.js';
import play, { YouTubeVideo } from 'play-dl';
import { Bot } from './Bot';
import logger from './Logger';
import localConfig from './local.config.json';

export class MusicPlayer {

    private songQueue: YouTubeVideo[] = [];
    private currentSong?: YouTubeVideo;
    private audioPlayer: AudioPlayer;
    private _volume: number = 0.05;
    private inactivityTimeout: NodeJS.Timeout | null = null;

    public get volume() {
        return this._volume;
    }
    public set volume(volume: number) {
        this._volume = volume;

        if (this.audioPlayer.state.status !== AudioPlayerStatus.Idle) {
            const volumeTransformer = this.audioPlayer.state.resource.volume;
            volumeTransformer?.setVolume(this._volume);
        }
    }

    // public get currentVoiceChannelID() : string | undefined {
    //     const connection = getVoiceConnection(this.guildID);
    //     if (!connection) {
    //         return;
    //     }
    //     return connection.joinConfig.channelId;
    // }

    public getQueue() {
        return this.songQueue.slice();
    }

    /**
     * Removes a song from the queue
     * @param num 1-based index
     */
    public removeSongFromQueue(num: number) {
        this.songQueue.splice(num - 1, 1);
    }

    public getNowPlaying() {
        return this.currentSong;
    }

    constructor(private bot: Bot, private guildId: string) {
        this.setupSpotify();
        this.setupSoundCloud();
        this.audioPlayer = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play,
            },
        });
        this.audioPlayer.on('stateChange', (oldState, newState) => {
            if (newState.status === AudioPlayerStatus.Idle) {
                this.currentSong = undefined;
                const nextSong = this.songQueue.shift();
                if (nextSong) {
                    this.playSong(nextSong);
                } else {
                    this.clearStatus();
                    logger.info('Queue is empty, setting inactivity timer');
                    this.startInactivityTimer();
                }
            }
        });
    }

    public async queue(query: string, toFront: boolean = false): Promise<YouTubeVideo[] | string | undefined> {
        // Start inactivity timer if not currently playing, will be cleared if it successfully plays something
        this.startInactivityTimer();

        const validation = await play.validate(query);
        logger.info(`validation: ${validation}`);
        const videosToPlay: YouTubeVideo[] = [];
        switch (validation) {
            case 'search': {
                const results = await this.search(query);
                if (results.length === 0) {
                    return 'Search returned no results';
                }
                const cmp = <T>(a: T, b: T) => a === b ? 0 : a ? -1 : 1;
                results.sort((a, b) => cmp(a.channel?.name?.endsWith('- Topic'), b.channel?.name?.endsWith('- Topic')))
                    .sort((a, b) => cmp(a.channel?.artist, b.channel?.artist));
                logger.info(`Playing first song from search at ${results[0]}:${results[0].likes}`);
                videosToPlay.push(results[0]);
                break;
            }
            case 'yt_video': {
                try {
                    const ytInfo = await play.video_info(query);
                    videosToPlay.push(ytInfo.video_details);
                    logger.info(`Song from URL: ${ytInfo.video_details.title}`);
                } catch (ex) {
                    return 'Error fetching video info. Try using /play with search terms';
                }
                break;
            }
            case 'yt_playlist': {
                const playlist = await play.playlist_info(query, { incomplete: true });
                videosToPlay.push(...await playlist.all_videos());
                break;
            }
            default:
                return 'Source not supported';
        }

        if (toFront) {
            this.songQueue.unshift(...videosToPlay);
        } else {
            this.songQueue.push(...videosToPlay);
        }

        if (this.audioPlayer.state.status === AudioPlayerStatus.Idle) {
            logger.info('player is idle so playing now');
            const nextSong = this.songQueue.shift();
            if (!nextSong) {
                return 'Unknown error ocurred. Song should have been in queue';
            }
            this.playSong(nextSong);
        }


        // const audio = createAudioResource(String.raw`N:\Music\Neil Cicierega\Mouth Moods\Bustin.mp3`, {
        //     inlineVolume: true,
        // });

        return videosToPlay;
    }

    public async search(query: string, limit: number = 1): Promise<YouTubeVideo[]> {
        return await play.search(query, {
            limit,
        });
    }

    public clearQueue() {
        this.songQueue = [];
    }

    public stop() {
        // Clear queue before stop, otherwise the event would start the next song
        this.clearQueue();
        this.audioPlayer.stop(true);
    }

    public skip() {
        // Event will play next song
        this.audioPlayer.stop();
    }

    public togglePause() {
        if (this.audioPlayer.state.status === AudioPlayerStatus.Paused) {
            this.audioPlayer.unpause();
            return false;
        } else {
            this.audioPlayer.pause();
            return true;
        }
    }

    private async playSong(song: YouTubeVideo) {
        if (this.inactivityTimeout) {
            logger.info('Clearing inactivity timer');
            clearTimeout(this.inactivityTimeout);
            this.inactivityTimeout = null;
        }
        const connection = getVoiceConnection(this.guildId);
        if (!connection) {
            console.error('no voice connection!');
            return;
        }

        try {
            const stream = await play.stream(song.url);
            const audio = createAudioResource(stream.stream, {
                inlineVolume: true,
                inputType: stream.type,
            });
            connection.subscribe(this.audioPlayer);
            this.currentSong = song;
            this.audioPlayer.play(audio);
            audio.volume?.setVolume(this._volume);

            this.updateStatus(song);
        } catch (e) {
            console.error(e);
            return;
        }
    }

    private async setupSpotify() {
        if (play.is_expired()) {
            await play.refreshToken();
        }
    }

    private async setupSoundCloud() {
        const soundCloudClientID = await play.getFreeClientID();
        play.setToken({ soundcloud: { client_id: soundCloudClientID } });
    }

    private async updateStatus(song: YouTubeVideo) {
        const songTitle = song.title ?? 'a song';
        this.bot.setStatus(songTitle);

        const statusEmbed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setAuthor({
                name: song.channel?.name ?? 'Unknown Channel',
                iconURL: song.channel?.icons ? song.channel.icons[song.channel.icons.length - 1].url : undefined,
                url: song.channel?.url,
            })
            .setTitle(song.title ?? 'Unknown Title')
            .setURL(song.url)
            .setImage(song.thumbnails[song.thumbnails.length - 1].url)
            .setFooter({ text: 'YOC Bot' });

        if (song.live) {
            statusEmbed.addFields({ name: 'Live', value: '🔴' });
        } else {
            statusEmbed.addFields({ name: 'Length', value: song.durationRaw });
        }

        const statusChannel = await this.bot.client.channels.fetch(localConfig.statusChannelId, { force: true });
        if (statusChannel?.isSendable()) {
            if (statusChannel.lastMessageId) {
                try {
                    const msg = await statusChannel.messages.fetch({ message: statusChannel.lastMessageId, force: true });
                    await msg.edit({ embeds: [ statusEmbed ] });
                } catch (ex) {
                    logger.error(ex);
                    await statusChannel.send({ embeds: [ statusEmbed ]});
                }
            } else {
                await statusChannel.send({ embeds: [ statusEmbed ]});
            }
        }
    }

    private async clearStatus() {
        this.bot.clearStatus();

        const statusEmbed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setDescription('Nothing in the queue');

        const statusChannel = await this.bot.client.channels.fetch(localConfig.statusChannelId, { force: true });
        if (statusChannel?.isSendable()) {
            if (statusChannel.lastMessageId) {
                try {
                    const msg = await statusChannel.messages.fetch({ message: statusChannel.lastMessageId, force: true });
                    await msg.edit({ embeds: [ statusEmbed ] });
                } catch (ex) {
                    await statusChannel.send({ embeds: [ statusEmbed ]});
                }
            } else {
                await statusChannel.send({ embeds: [ statusEmbed ]});
            }
        }
    }

    private startInactivityTimer() {
        if (this.audioPlayer.state.status !== AudioPlayerStatus.Idle) {
            return;
        }

        if (this.inactivityTimeout) {
            clearTimeout(this.inactivityTimeout);
        }

        this.inactivityTimeout = setTimeout(() => {
            logger.info('Inactivity timer reached, leaving voice channel');
            this.bot.leaveVoiceChannel(this.guildId);
        }, 1000 * 60 * 5); // 5 minutes
    }
}
