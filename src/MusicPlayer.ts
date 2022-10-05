import { AudioPlayer, AudioPlayerStatus, createAudioPlayer, createAudioResource, getVoiceConnection, NoSubscriberBehavior } from '@discordjs/voice';
import play, { YouTubeVideo } from 'play-dl';
import { Bot } from './Bot';
import logger from './Logger';

export class MusicPlayer {

    private songQueue: YouTubeVideo[] = [];
    private currentSong?: YouTubeVideo;
    private audioPlayer: AudioPlayer;
    private _volume: number = 0.1;

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

    public getNowPlaying() {
        return this.currentSong;
    }

    constructor(private bot: Bot, private guildID: string) {
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
                    this.bot.clearStatus();
                }
            }
        });
    }

    public async queue(query: string): Promise<YouTubeVideo | string | undefined> {

        const validation = await play.validate(query);
        logger.info(`validation: ${validation}`);
        let details: YouTubeVideo;
        if (!validation) {
            return 'Source not supported';
        } else if (validation === 'search') {
            const results = await this.search(query);
            if (results.length === 0) {
                return 'Search returned no results';
            }
            details = results[0];
        } else {
            const ytInfo = await play.video_info(query);
            details = ytInfo.video_details;
            logger.info(`Song from URL: ${ytInfo.video_details.title}`);
        }

        if (this.audioPlayer.state.status === AudioPlayerStatus.Idle) {
            logger.info('player is idle so playing now');
            this.playSong(details);
        } else {
            logger.info('adding song to queue');
            this.songQueue.push(details);
        }


        // const audio = createAudioResource(String.raw`N:\Music\Neil Cicierega\Mouth Moods\Bustin.mp3`, {
        //     inlineVolume: true,
        // });

        return details;
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
        this.audioPlayer.stop();
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
        const connection = getVoiceConnection(this.guildID);
        if (!connection) {
            console.error('no voice connection!');
            return;
        }

        const stream = await play.stream(song.url);
        const audio = createAudioResource(stream.stream, {
            inlineVolume: true,
            inputType: stream.type,
        });
        connection.subscribe(this.audioPlayer);
        this.currentSong = song;
        this.audioPlayer.play(audio);
        audio.volume?.setVolume(this._volume);
        const songTitle = song.title ?? 'a song';
        this.bot.setStatus(songTitle);
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
}
