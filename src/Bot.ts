import { getVoiceConnection, joinVoiceChannel, VoiceConnection } from '@discordjs/voice';
import { ActivityType, ChatInputCommandInteraction, Client, GatewayIntentBits, Guild, GuildMember, Interaction, Options, VoiceBasedChannel } from 'discord.js';
import { readdirSync } from 'fs';
import path from 'path';
import { guildId } from './local.config.json';
import { CommandLoader } from './CommandLoader';
import { MetadataManager } from './MetadataManager';

import { MusicPlayer } from './MusicPlayer';
import { SlashCommand } from './SlashCommand';
import logger from './Logger';

// logger.info(generateDependencyReport());

export class Bot {
    private _musicPlayer: MusicPlayer = new MusicPlayer(this, guildId);
    private _client!: Client;
    public get client(): Client {
        return this._client;
    }

    public get musicPlayer(): MusicPlayer {
        return this._musicPlayer;
    }

    private commands: SlashCommand[] = [];

    constructor() {
        this._client = new Client({
            sweepers: {messages: {interval: 43200, lifetime: 21600}},
            makeCache: Options.cacheWithLimits({
                MessageManager: 25,
            }),
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildIntegrations,
            ],
        });

        this.onReady();
        this.onInteractionCreate();
        this.onVoiceStateUpdate();

        // Load commands
        const commandLoader = new CommandLoader('commands');
        commandLoader.loadAll();

        this.commands = MetadataManager.instance.slashCommands;
    }

    public login(token: string) {
        this._client.login(token);
    }

    public clearStatus() {
        if (!this._client || !this._client.user) {
            return;
        }

        this._client.user.setPresence({
            status: 'online',
            activities: [
                {
                    name: 'its own thoughts',
                    type: ActivityType.Listening,
                },
            ],
        });
    }

    public setStatus(status: string, type: Exclude<ActivityType, ActivityType.Custom> = ActivityType.Listening) {
        if (!this._client || !this._client.user) {
            return;
        }

        this._client.user.setPresence({
            status: 'online',
            activities: [
                {
                    name: status,
                    type,
                },
            ],
        });
    }

    public joinVoiceChannel(channel: VoiceBasedChannel): VoiceConnection {
        // Reset volume when joining channel in case some crazies left it crazy
        this._musicPlayer.volume = 0.05;
        return joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });
    }

    public leaveVoiceChannel(guildId: string): boolean {
        const connection = getVoiceConnection(guildId);
        if (connection) {
            connection.destroy();
            return true;
        }

        return false;
    }

    private onReady() {
        this._client.on('ready', async () => {
            if (!this._client.user || !this._client.application) {
                return;
            }

            this.clearStatus();

            logger.info(`${this._client.user.username} is online`);
        });
    }

    private onInteractionCreate() {
        this._client.on('interactionCreate', async (interaction: Interaction) => {
            if (interaction.isChatInputCommand()) {
                await this.handleSlashCommand(interaction);
            } else if (interaction.isSelectMenu()) {
                if (interaction.customId === 'search-song-select') {
                    await interaction.deferUpdate();

                    const member = interaction.member as GuildMember;
                    // TODO: check if youre in the SAME channel
                    if (!member?.voice?.channel) {
                        await interaction.update('You must be in a voice channel to use this command');
                        return;
                    }
                    const connection = getVoiceConnection(member.voice.guild.id);
                    if (!connection) {
                        this.joinVoiceChannel(member.voice.channel);
                    }
                    const songURL = interaction.values[0];
                    logger.info(`Selected ${songURL} from the list`);
                    const song = await this.musicPlayer.queue(songURL);
                    if (!song || typeof song === 'string') {
                        await interaction.update(song || 'An error occurred');
                        return;
                    }
                    await interaction.editReply({
                        content: `🎶 | Queued up **${song[0].title}**!`,
                        components: [],
                    });
                }
            }
        });
    }

    private onVoiceStateUpdate() {
        this._client.on('voiceStateUpdate', (before, after) => {
            // Only bot left
            const vc = getVoiceConnection(guildId);
            if (vc && vc.joinConfig.channelId === before.channelId && before.channel?.members.size === 1) {
                this.musicPlayer.stop();
                this.leaveVoiceChannel(guildId);
            }
        });
    }

    private async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        // logger.info('loaded commands');
        // for (const cmd of this.commands) {
        //     logger.info(cmd.toJSON());
        //     logger.info(cmd.execute);
        // }

        await interaction.deferReply({ ephemeral: true });

        const slashCommand = this.commands.find(c => c.name === interaction.commandName);
        if (!slashCommand) {
            logger.info(`no command: ${interaction.commandName}`);
            interaction.followUp({ content: 'An error has occurred' });
            return;
        }

        logger.info(`Recieved command: ${interaction.commandName}`);

        await slashCommand.execute(this, interaction);
    }
}

// player.on('trackStart', (queue: Queue<QueueMetadata>, track) => queue.metadata.channel.send(`🎶 | Now playing **${track.title}**!`))

// https://discord.com/channels/146029873629102080/1014356927196712980/1014396
