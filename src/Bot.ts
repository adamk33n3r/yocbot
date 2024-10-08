import { getVoiceConnection, joinVoiceChannel, VoiceConnection } from '@discordjs/voice';
import { isAfter, isSameDay, subHours } from 'date-fns';
import { ActivityType, ChatInputCommandInteraction, Client, Collection, Events, GatewayIntentBits, Guild, GuildMember, Interaction, ModalBuilder, Options, Role, SendableChannels, TextBasedChannel, TextChannel, VoiceBasedChannel } from 'discord.js';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as cron from 'node-cron';

import { CommandLoader } from './CommandLoader';
import { EventService } from './database/EventService';
import { EventManager } from './events/EventManager';
import { EventMessageBuilder, EventMessageMode } from './events/EventMessageBuilder';
import { guildId } from './local.config.json';
import logger from './Logger';
import { MetadataManager } from './MetadataManager';
import { ScheduleModal } from './modals/ScheduleModal';
import { MusicPlayer } from './MusicPlayer';
import { InfoModal } from './modals/InfoModal';
import { MovieListMessageBuilder } from './movienight/MovieListMessageBuilder';
import { MovieService } from './database/MovieService';
import { Movie } from './movienight/Movie';
import { SlashCommandCollection } from './SlashCommandGroup';

// logger.info(generateDependencyReport());

export class Bot {
    private static _instance: Bot;
    public static getInstance(): Bot {
        return this._instance;
    }
    private _musicPlayer: MusicPlayer = new MusicPlayer(this, guildId);
    private _client!: Client;
    public get client(): Client {
        return this._client;
    }

    public get musicPlayer(): MusicPlayer {
        return this._musicPlayer;
    }

    public get isProd(): boolean {
        return this._isProd;
    }

    public get guild(): Guild {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this._client.guilds.cache.find((guild) => guild.id == guildId)!;
    }

    private slashCommands: SlashCommandCollection = new Collection();
    public get commands(): SlashCommandCollection {
        return new Collection(this.slashCommands);
    }

    constructor(private _isProd: boolean) {
        Bot._instance = this;
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
                GatewayIntentBits.GuildScheduledEvents,
            ],
        });

        logger.info('Starting up...', new Date());

        this.onReady();
        this.onInteractionCreate();
        this.onVoiceStateUpdate();

        // Load commands
        const commandLoader = new CommandLoader('commands');
        commandLoader.loadAll();

        this.slashCommands = MetadataManager.instance.slashCommands;

        initializeApp({
            credential: applicationDefault(),
        });
        getFirestore().settings({
            ignoreUndefinedProperties: true,
        });

        // this.setUpEventTimers();
    }

    public reloadCommands() {
        this.commands.forEach((cmd) => {
            if (cmd.parent) {
                this.reloadCommand(cmd.parent.className);
            } else {
                logger.error('Could not reload command:', cmd.fullName, 'No parent set');
            }
        });
    }

    public reloadCommand(commandFile: string): boolean {
        try {
            const filePath = `./commands/${commandFile}`;
            const resolved = require.resolve(filePath);
            delete require.cache[resolved];
            const commandLoader = new CommandLoader('commands');
            commandLoader.load(commandFile);

            this.slashCommands = MetadataManager.instance.slashCommands;
            return true;
        } catch {
            logger.error('Could not find command file:', commandFile);
            return false;
        }
    }

    private setUpEventTimers() {
        // clean up orphaned discord events
        cron.schedule('0 0 * * *', async (now) => {
            logger.info('Running cleanup job');
            const events = await EventManager.getInstance().getEvents();
            const discordEventIds = events.filter(e => e.nextEvent).map(e => e.nextEvent!.discordEventId);
            const dEvents = await this.guild.scheduledEvents.fetch();
            dEvents
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                .filter(dEvent => dEvent.creatorId === this._client.user!.id)
                .filter(dEvent => !discordEventIds.includes(dEvent.id))
                .each(dEvent => {
                    this.guild.scheduledEvents.delete(dEvent);
                });
        });

        //              ┌────────────── second (optional)
        //              │ ┌──────────── minute
        //              │ │ ┌────────── hour
        //              │ │ │ ┌──────── day of month
        //              │ │ │ │ ┌────── month
        //              │ │ │ │ │ ┌──── day of week
        //              │ │ │ │ │ │
        //              │ │ │ │ │ │
        //              * * * * * *
        // Scheduled for 57 so that if an event is created for "now",
        // then it will still pick it up.
        
        async function sendEventAnnouncement(channel: SendableChannels, message: string, role?: Role) {
            channel.send(role ? `${role.toString()} ${message}` : message);
        }
        cron.schedule('2 * * * * *', async (now) => {

            if (!this._client.isReady()) {
                logger.error('Client isn\'t ready...');
                return;
            }
            if (now === 'manual' || now === 'init') {
                now = new Date();
            }
            logger.debug('var:', now);
            logger.debug('actual:', new Date());
            logger.debug('Checking events...');
            const events = await EventManager.getInstance().getEvents();
            logger.debug('event#:', events.length);
            // TODO: Instead of looping over EVERY event, maybe we can query the time to only get todays at least
            for (const event of events) {
                try {
                    // handle creation/deletion
                    const dEvent = await EventManager.getInstance().manageEvent(this.guild.scheduledEvents, event);
                    if (!dEvent || !event.nextEvent?.discordEvent)
                        continue;

                    const eventDate = event.nextEvent.discordEvent.scheduledStartAt;
                    if (!eventDate) // Shouldn't happen, our events always have a start datetime
                        continue;
                    logger.debug([now, eventDate, isSameDay(now, eventDate)]);
                    const channel = this._client.channels.cache.get(event.announcementChannelId);
                    if (!channel?.isSendable()) {
                        logger.error(`not a sendable text channel: ${event.announcementChannelId}`);
                        continue;
                    }

                    // logger.debug(`${event.postPrior}:${event.nextEvent.postPriorSent}`, event, now, eventDate, isAfter(now, subHours(eventDate, 1)));

                    if (event.postAt && !event.nextEvent.postAtSent && isAfter(now, eventDate)) {
                        event.nextEvent.postAtSent = true;
                        logger.info(`postAt: ${event.name}`);
                        await sendEventAnnouncement(channel, `Time for ${event.name}!`, event.pingRole);
                        await EventManager.getInstance().updateEvent(event);
                    } else if (event.postPrior && !event.nextEvent.postPriorSent && isAfter(now, subHours(eventDate, 1))) {
                        event.nextEvent.postPriorSent = true;
                        logger.info(`postPrior: ${event.name}`);
                        await sendEventAnnouncement(channel, `${event.name} starts <t:${Math.floor(eventDate.getTime()/1000)}:R>!`, event.pingRole);
                        await EventManager.getInstance().updateEvent(event);
                    } else if (event.postMorning && !event.nextEvent.postMorningSent && now.getHours() === 8 && isSameDay(now, eventDate)) {
                        event.nextEvent.postMorningSent = true;
                        logger.info(`postMorning: ${event.name}`);
                        // channel.send(`${event.name} is today at ${format(eventDate, 'h:mm aaa')}!`);
                        await sendEventAnnouncement(channel, `${event.name} is today at <t:${Math.floor(eventDate.getTime()/1000)}:t>!`, event.pingRole);
                        await EventManager.getInstance().updateEvent(event);
                    } else {
                        logger.debug(`no alert for ${event.id}`);
                    }
                } catch (e) {
                    logger.error('Error in event cron', e);
                }
            }
        }, {
            recoverMissedExecutions: false, // when scheduled to run once a minute, it runs twice
            runOnInit: false, // running on init can cause some race condition stuff if it creates a discord event
        });
    }

    public async seedDB() {
        if (this.isProd) {
            return;
        }

        const eventDB = EventService.getInstance();

        // await eventDB.deleteAll();

        // EventManager.getInstance().createEvent(this.guild.scheduledEvents, {
        //     name: 'Test Event',
        //     startDate: new Date(),
        //     channel: '921199392827006996',
        //     createdBy: '',
        // });
        const events = await eventDB.getEvents();
        logger.debug('all events:', events);
        // logger.debug('on monday:', !!(events[0].recurringDays & Days.MONDAY));

        if ((await MovieService.getInstance().getMovies(true)).length === 0) {
            logger.debug('Seeding db with movies...');
            const movies = [];
            for (let idx = 1; idx <= 25; idx++) {
                movies.push(MovieService.getInstance().createMovie(new Movie({
                    title: `Movie ${idx}`,
                })));
            }
            await Promise.all(movies);
            logger.debug('Done');
        }
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
        this._client.on(Events.ClientReady, async () => {
            if (!this._client.user || !this._client.application) {
                return;
            }
            logger.info(`${this._client.user.username} is online`);

            this.clearStatus();
            await this.seedDB();
            this.setUpEventTimers();

            // const event = (await EventService.getInstance().getEvents())[0];
            // const dEvent = await this._client.guilds.cache.find((g) => g.id == guildId)!.scheduledEvents.create({
            //     name: 'Event Name',
            //     entityType: GuildScheduledEventEntityType.Voice,
            //     privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
            //     scheduledStartTime: event.startDate.toDate(),
            //     channel: event.channel,
            // });
            // if (dEvent) {
            //     event.discordEvent = dEvent.id;
            //     EventService.getInstance().updateEvent(event);
            // } else {
            //     logger.debug('failed to create event');
            // }

            // const rest = new RESTWithTypes({ version: '10' }).setToken(!this._isProd ? testBot.token : token);
            // EventManager.getInstance().getEvent('BlTY0up3tXE0ZJKVXJci').then(partialEvent => {
            //     if (!partialEvent) return;
            //     rest.post(Routes.channelMessages('1014356927196712980'), {
            //         body: {
            //             embeds: [{
            //                 color: 0x0099ff,
            //                 title: partialEvent.name,
            //                 description: partialEvent.description || null,
            //                 fields: [
            //                     { name: 'Start Date', value: partialEvent.startDate ? `<t:${partialEvent.startDate.getTime()/1000}:F>` : 'Not set', inline: true },
            //                     { name: 'Voice Channel', value: partialEvent.voiceChannel?.name ?? 'Not set', inline: true },
            //                     { name: 'Announcement Channel', value: partialEvent.announcementChannel?.name ?? 'Not set', inline: true },
            //                     { name: 'End Date', value: partialEvent.startDate ? `<t:${partialEvent.startDate.getTime()/1000}:F>` : 'Not set', inline: true },
            //                     { name: 'Recurring Type', value: 'Weekly', inline: true },
            //                     { name: 'Recurring Days', value: 'MWF', inline: true },
            //                     { name: 'Post Morning', value: 'true', inline: true },
            //                     { name: 'Post Prior', value: 'true', inline: true },
            //                     { name: 'Post At', value: 'true', inline: true },
            //                     // { name: '\u200b', value: '\u200b' },
            //                 ],
            //             }],
            //         },
            //     });
            // });
        });
    }

    private onInteractionCreate() {
        this._client.on(Events.InteractionCreate, async (interaction: Interaction) => {
            try {
                if (interaction.isChatInputCommand()) {
                    await this.handleSlashCommand(interaction);
                } else if (interaction.isAutocomplete()) {
                    let commandName = interaction.commandName;
                    const subCommand = interaction.options.getSubcommand(false);
                    if (subCommand) {
                        commandName += ':' + subCommand;
                    }

                    const slashCommand = this.slashCommands.find(c => c.fullName === commandName);
                    if (!slashCommand) {
                        logger.info(`no command: ${commandName}`);
                        return;
                    }

                    await slashCommand.autocomplete(this, interaction);
                } else if (interaction.isStringSelectMenu()) {
                    logger.debug('String Select:', interaction.customId);
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
                    } else if (interaction.customId.startsWith('schedule:')) {
                        const matches = interaction.customId.match(/schedule:(\w+):(\w+)/);
                        if (!matches) {
                            throw new Error(`Could not parse schedule select: ${interaction.customId}`);
                        }
                        const [_, propName, eventId] = matches;
                        const partialEvent = await EventManager.getInstance().getEvent(eventId);
                        if (!partialEvent) {
                            throw new Error(`Could not find event with id: ${eventId}`);
                        }
                        if (propName === 'recurringType') {
                            partialEvent.recurringType = Number.parseInt(interaction.values[0]);
                        } else if (propName === 'recurringDays') {
                            partialEvent.recurringDays = interaction.values.reduce((acc, d) => acc | Number.parseInt(d), 0);
                        }
                        await EventManager.getInstance().updateEvent(partialEvent);
                        await interaction.update(EventMessageBuilder.buildMessage(partialEvent, EventMessageMode.EDIT));
                    }
                } else if (interaction.isRoleSelectMenu()) {
                    if (interaction.customId.startsWith('schedule:')) {
                        const matches = interaction.customId.match(/schedule:(\w+):(\w+)/);
                        if (!matches) {
                            throw new Error(`Could not parse schedule select: ${interaction.customId}`);
                        }
                        const [_, propName, eventId] = matches;
                        const partialEvent = await EventManager.getInstance().getEvent(eventId);
                        if (!partialEvent) {
                            throw new Error(`Could not find event with id: ${eventId}`);
                        }
                        if (propName === 'pingRole') {
                            partialEvent.pingRoleId = interaction.values[0];
                        }
                        await EventManager.getInstance().updateEvent(partialEvent);
                        await interaction.update(EventMessageBuilder.buildMessage(partialEvent, EventMessageMode.EDIT));
                    }
                } else if (interaction.isButton()) {
                    logger.debug('Button:', interaction.customId);
                    if (interaction.customId.startsWith('schedule')) {
                        const command = interaction.customId.substring('schedule:'.length);
                        if (command.startsWith('modal')) {
                            const matches = command.match(/modal:(\w+):(\w+)/);
                            if (!matches) {
                                throw new Error(`Could not parse modal command: ${command}`);
                            }
                            const [_, modalName, eventId] = matches;
                            const partialEvent = await EventManager.getInstance().getEvent(eventId);
                            if (!partialEvent) {
                                throw new Error(`Could not find event with id: ${eventId}`);
                            }
                            let modal: ModalBuilder | undefined;
                            switch (modalName) {
                                case 'info':
                                    modal = new InfoModal(partialEvent).modal;
                                    break;
                                case 'schedule':
                                    modal = new ScheduleModal(partialEvent).modal;
                                    break;
                            }
                            // if (modalName === 'schedule') {
                            //     // interaction.awaitModalSubmit({ time: 60_000, filter: m => m.user.id === interaction.user.id && m.customId === interaction.customId })
                            //     //     .then(async (modalSubmitInteraction) => {
                            //     //         ScheduleModal.processDate(partialEvent, modalSubmitInteraction);
                            //     //         await EventManager.getInstance().updateEvent(partialEvent);
                            //     //         if (modalSubmitInteraction.isFromMessage()) {
                            //     //             await modalSubmitInteraction.update(EventMessageBuilder.buildMessage(partialEvent));
                            //     //         }
                            //     //     });
                            // }
                            if (modal)
                                await interaction.showModal(modal);
                        } else if (command.startsWith('toggle:')) {
                            const matches = command.match(/toggle:(\w+):(\w+)/);
                            if (!matches) {
                                throw new Error(`Could not parse update command: ${command}`);
                            }
                            const [_, propName, eventId] = matches;
                            const partialEvent = await EventManager.getInstance().getEvent(eventId);
                            if (!partialEvent) {
                                throw new Error(`Could not find event with id: ${eventId}`);
                            }
                            logger.debug(`Toggling propname (${propName}) from ${partialEvent[propName]}`);
                            partialEvent[propName] = !partialEvent[propName];
                            await EventManager.getInstance().updateEvent(partialEvent);
                            await interaction.update(EventMessageBuilder.buildMessage(partialEvent, EventMessageMode.EDIT));
                        } else if (command.startsWith('cancel:')) {
                            const matches = command.match(/cancel:(\w+)/);
                            if (!matches) {
                                throw new Error(`Could not parse cancel command: ${command}`);
                            }
                            const [_, eventId] = matches;
                            const partialEvent = await EventManager.getInstance().getEvent(eventId);
                            if (!partialEvent) {
                                throw new Error(`Could not find event with id: ${eventId}`);
                            }
                            await EventManager.getInstance().deleteEvent(partialEvent);
                            await interaction.update({
                                content: 'Canceled event creation. You can dismiss this message.',
                                attachments: [],
                                embeds: [],
                                components: [],
                            });
                        } else if (command.startsWith('create:')) {
                            const matches = command.match(/create:(\w+)/);
                            if (!matches) {
                                throw new Error(`Could not parse create command: ${command}`);
                            }
                            const [_, eventId] = matches;
                            const partialEvent = await EventManager.getInstance().getEvent(eventId);
                            if (!partialEvent) {
                                throw new Error(`Could not find event with id: ${eventId}`);
                            }
                            await EventManager.getInstance().finishEventCreation(this.guild.scheduledEvents, partialEvent);
                            await interaction.update(EventMessageBuilder.buildMessage(partialEvent, EventMessageMode.EMBED_ONLY));
                        }
                    } else if (interaction.customId.startsWith('movielist')) {
                        const arg = interaction.customId.split(':')[1];
                        const all = !!interaction.customId.split(':')[2];
                        const movies = await MovieService.getInstance().getMovies(all);
                        let pageNum: number;
                        if (arg === 'start') {
                            pageNum = 0;
                        } else if (arg === 'end') {
                            pageNum = -1;
                        } else {
                            pageNum = Number.parseInt(arg);
                        }
                        await interaction.update(MovieListMessageBuilder.buildMessage(movies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()), all, interaction.user, pageNum));
                    }
                } else if (interaction.isModalSubmit()) {
                    logger.debug(`got modal submit: ${interaction.customId}`);
                    // Schedule modal - date/time/recurring
                    if (interaction.customId.startsWith('schedule')) {
                        const command = interaction.customId.substring('schedule:'.length);
                        if (command.startsWith('modal')) {
                            const matches = interaction.customId.match(/modal:(\w+):(\w+)/);
                            if (!matches) {
                                throw new Error(`Could not parse modal submit command: ${interaction.customId}`);
                            }
                            const [_, modalName, eventId] = matches;
                            const partialEvent = await EventManager.getInstance().getEvent(eventId);
                            if (!partialEvent) {
                                throw new Error(`Could not find event with id: ${eventId}`);
                            }
                            // TODO: use modalName to get the class and access static constants for values maybe?
                            // Or add methods to teh modal class to parse the data and edit the event
                            switch (modalName) {
                                case 'info':
                                    InfoModal.processData(partialEvent, interaction);
                                    break;
                                case 'schedule':
                                    ScheduleModal.processData(partialEvent, interaction);
                                    break;
                            }
                            await EventManager.getInstance().updateEvent(partialEvent);
                            if (interaction.isFromMessage())
                                await interaction.update(EventMessageBuilder.buildMessage(partialEvent, EventMessageMode.EDIT));
                        }
                    }
                } else {
                    logger.debug(`Unhandled interaction event: ${interaction.type}`);
                }
            } catch (e: any) {
                logger.error('Error occurred in interaction handler:', e, e.code);
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

        let commandName = interaction.commandName;
        const subCommand = interaction.options.getSubcommand(false);
        if (subCommand) {
            commandName += ':' + subCommand;
        }

        const slashCommand = this.slashCommands.find(c => c.fullName === commandName);
        if (!slashCommand) {
            logger.info(`no command: ${commandName}`);
            await interaction.followUp({ content: 'An error has occurred' });
            return;
        }

        logger.info(`Recieved command: ${commandName}`);

        await slashCommand.execute(this, interaction);
    }
}

// player.on('trackStart', (queue: Queue<QueueMetadata>, track) => queue.metadata.channel.send(`🎶 | Now playing **${track.title}**!`))

// https://discord.com/channels/146029873629102080/1014356927196712980/1014396
