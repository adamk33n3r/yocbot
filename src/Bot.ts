import { getVoiceConnection, joinVoiceChannel } from '@discordjs/voice';
import { ActivityType, ChatInputCommandInteraction, Client, GatewayIntentBits, GuildMember, Interaction, Options } from 'discord.js';
import { readdirSync } from 'fs';
import path from 'path';
import { guildId } from './local.config.json';
import { CommandLoader } from './CommandLoader';
import { MetadataManager } from './MetadataManager';

import { MusicPlayer } from './MusicPlayer';
import { SlashCommand } from './SlashCommand';

// console.log(generateDependencyReport());

export class Bot {
    private _musicPlayer: MusicPlayer = new MusicPlayer(this, '146029873629102080');
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
                }
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
                }
            ],
        });
    }

    private onReady() {
        this._client.on('ready', async () => {
            if (!this._client.user || !this._client.application) {
                return;
            }

            this.clearStatus();

            console.log(`${this._client.user.username} is online`);
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
                    let connection = getVoiceConnection(member.voice.guild.id);
                    if (!connection) {
                        connection = joinVoiceChannel({
                            channelId: member.voice.channel.id,
                            guildId: member.guild.id,
                            adapterCreator: member.guild.voiceAdapterCreator,
                        });
                    }
                    const songURL = interaction.values[0];
                    console.log(`Selected ${songURL} from the list`);
                    const song = await this.musicPlayer.queue(songURL);
                    if (!song || typeof song === 'string') {
                        await interaction.update(song || 'An error occurred');
                        return;
                    }
                    await interaction.editReply({
                        content: `🎶 | Queued up **${song.title}**!`,
                        components: [],
                    });
                }
            }
        });
    }

    private async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        console.log('loaded commands');
        // for (const cmd of this.commands) {
        //     console.log(cmd.toJSON(), cmd.execute);
        // }

        await interaction.deferReply({ ephemeral: true });

        const slashCommand = this.commands.find(c => c.name === interaction.commandName);
        if (!slashCommand) {
            console.log('no command:', interaction.commandName);
            interaction.followUp({ content: 'An error has occurred' });
            return;
        }

        console.log(`Recieved command: ${interaction.commandName}`);

        await slashCommand.execute(this, interaction);
    }
}

// player.on('trackStart', (queue: Queue<QueueMetadata>, track) => queue.metadata.channel.send(`🎶 | Now playing **${track.title}**!`))

// https://discord.com/channels/146029873629102080/1014356927196712980/1014396
