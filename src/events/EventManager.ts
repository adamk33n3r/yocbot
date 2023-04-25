import { isBefore, getDay, nextDay, setHours, setMinutes, isAfter, addHours, addMinutes, setSeconds } from 'date-fns';
import { GuildScheduledEvent, GuildScheduledEventEntityType, GuildScheduledEventManager, GuildScheduledEventPrivacyLevel, GuildScheduledEventStatus, GuildTextChannelResolvable, GuildVoiceChannelResolvable, RoleResolvable, Snowflake } from 'discord.js';
import { EventService } from 'src/database/EventService';
import { Days, Event, IEventData, IEventDataComplete, RecurringType } from './Event';
import logger from 'src/Logger';

export interface EventCreateOptions {
    name: string;
    description?: string;
    voiceChannel: GuildVoiceChannelResolvable;
    announcementChannel: GuildTextChannelResolvable;
    pingRole?: RoleResolvable;
    createdBy: Snowflake;
    image?: string;
}
export interface EventCompleteOptions {
    startDate: Date;
    endDate?: Date;
    recurringType: RecurringType;
    recurringDays: Days; // bitmask
    postMorning: boolean;
    postPrior: boolean;
    postAt: boolean;
}

const dayToNum: Record<Days, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
    [Days.NONE]: 0,
    [Days.SUNDAY]: 0,
    [Days.MONDAY]: 1,
    [Days.TUESDAY]: 2,
    [Days.WEDNESDAY]: 3,
    [Days.THURSDAY]: 4,
    [Days.FRIDAY]: 5,
    [Days.SATURDAY]: 6,
};

export class EventManager {
    private static _instance: EventManager;
    public static getInstance(): EventManager {
        if (!this._instance) {
            this._instance = new EventManager();
        }
        return this._instance;
    }

    private event$: EventService;

    private constructor() {
        this.event$ = EventService.getInstance();
    }

    public async createEvent(eventOptions: EventCreateOptions): Promise<Event> {
        const event = Event.createRaw({
            name: eventOptions.name,
            partial: true,
            description: eventOptions.description,
            imageUrl: eventOptions.image,
            voiceChannelId: typeof eventOptions.voiceChannel === 'string' ? eventOptions.voiceChannel : eventOptions.voiceChannel.id,
            announcementChannelId: typeof eventOptions.announcementChannel === 'string' ? eventOptions.announcementChannel : eventOptions.announcementChannel.id,
            pingRoleId: typeof eventOptions.pingRole === 'string' ? eventOptions.pingRole : eventOptions.pingRole?.id ?? undefined,
            createdById: eventOptions.createdBy,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const doc = await this.event$.createEvent(event);
        logger.debug('created doc:', doc.id);
        // it will exist since it was just created
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return (await doc.get()).data()!.withDiscordEntities();
    }

    public async finishEventCreation(eventManager: GuildScheduledEventManager, event: Event): Promise<Event> {
        if (!this.validateCreate(event)) {
            throw new Error('Tried to finish event creation but it failed validation', { cause: event });
        }

        event.partial = false;
        // event.startDate = eventOptions.startDate;
        // event.endDate = eventOptions.endDate;
        // event.recurringType = eventOptions.recurringType;
        // event.recurringDays = eventOptions.recurringDays;
        // event.postMorning = eventOptions.postMorning;
        // event.postPrior = eventOptions.postPrior;
        // event.postAt = eventOptions.postAt;

        const discordEvent = await this.manageEvent(eventManager, event);
        if (!discordEvent) {
            throw new Error(`Was returned null when trying to create discord event. Was start time wrong? ${event.startDate.toLocaleString()}`);
        }
        event.nextEvent = {
            discordEventId: discordEvent.id,
            discordEvent: discordEvent,
            postMorningSent: false,
            postPriorSent: false,
            postAtSent: false,
        };
        this.event$.updateEvent(event);

        return event;
    }

    public async getEvents() {
        return await this.event$.getEvents();
    }

    public async getEvent(id: string) {
        return await this.event$.getEvent(id);
    }

    public async updateEvent(event: Event) {
        return this.event$.updateEvent(event);
    }

    public async deleteEvent(event: Event) {
        return this.event$.deleteEvent(event);
    }

    public async manageEvent(eventManager: GuildScheduledEventManager, event: Event & IEventDataComplete): Promise<GuildScheduledEvent | null> {
        // If the discord event isn't active and it's been the duration after the start time, delete it
        if (event.nextEvent?.discordEvent?.scheduledStartTimestamp &&
            event.nextEvent.discordEvent.status !== GuildScheduledEventStatus.Active &&
            isAfter(Date.now(), addMinutes(event.nextEvent.discordEvent.scheduledStartTimestamp, event.duration))) {
            try {
                logger.debug('deleting past discord event');
                await eventManager.delete(event.nextEvent.discordEventId);
                delete (event as Event).nextEvent;
            } catch (e) {
                logger.warn('Tried to delete discord event, but it errored. Maybe it was deleted manually');
            }
        }

        // We don't need to do anything yet if there is still an event
        if (event.nextEvent?.discordEvent) {
            logger.debug('discord event is still good, returning');
            return event.nextEvent.discordEvent;
        }

        // If the next date is in the past, is not recurring, and the discord event is null, then we're done with it and can remove it
        const next = this.calculateNextEventDateTime(event);
        if (isBefore(next, Date.now()) && event.recurringType === RecurringType.NONE && !event.nextEvent?.discordEvent) {
            logger.debug('old event, deleting');
            await this.deleteEvent(event);
            return null;
        }

        if (isBefore(next, Date.now())) {
            throw new Error(`Next start time is in the past somehow...${next}: ${event.id}`);
        }

        logger.debug('creating new discord event...');
        const dEvent = await eventManager.create({
            name: event.name,
            description: (event.description ? (event.description + '\n\n') : '') + this.generateDescription(event),
            entityType: GuildScheduledEventEntityType.Voice,
            privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
            scheduledStartTime: next,
            // only used for external events, so not important
            scheduledEndTime: addMinutes(next, event.duration),
            channel: event.voiceChannelId,
            image: event.imageUrl || 'https://yoc.gg/assets/images/yoc-profile.png',
        });

        // Add discord event to the event
        event.nextEvent = {
            discordEventId: dEvent.id,
            discordEvent: dEvent,
            postMorningSent: false,
            postPriorSent: false,
            postAtSent: false,
        };
        this.updateEvent(event);

        return dEvent;
    }

    private calculateNextEventDateTime(event: Event & IEventDataComplete): Date {
        switch (event.recurringType) {
            case RecurringType.NONE:
                return event.startDate;
            case RecurringType.WEEKLY: {
                // today or event start date, which ever is later
                const dateToStartSearch = [new Date(), event.startDate].sort((a, b) => b.getTime() - a.getTime())[0];
                logger.debug('dateToStartSearch:', dateToStartSearch, new Date(), event.startDate);
                // get the soonest day out of the recurring days
                const eventDays = this.extractDays(event.recurringDays)
                    .map(day => (getDay(dateToStartSearch) === dayToNum[day] && isAfter(dateToStartSearch, Date.now())) ? dateToStartSearch : nextDay(dateToStartSearch, dayToNum[day]))
                    .sort((a, b) => a.getTime() - b.getTime());
                logger.debug('eventDays:', eventDays);
                const nextEventDay = eventDays[0];
                logger.debug('nextEventDay:', nextEventDay);
                return setSeconds(setMinutes(setHours(nextEventDay, event.startDate.getHours()), event.startDate.getMinutes()), 0);
            }
            default:
                return event.startDate;
        }
    }

    private extractDays(dayMask: number): Days[] {
        return Object.values(Days)
            .filter(v => typeof v === 'number')
            .map(v => v as Days)
            .filter(v => dayMask & v);
    }

    private extractDaysString(dayMask: number): string {
        return Object.entries(Days).filter(([_, v]) => typeof v === 'number')
            .map(([k, v]) => [k, v] as [string, Days])
            .reduce((str, [k, v]) => {
                if (dayMask & v) {
                    str += k[0];
                    if (v & Days.THURSDAY || v & Days.SATURDAY)
                        str += k[1];
                }
                return str;
            }, '');
    }

    private generateDescription(event: Event): string {
        let desc = '';
        if (event.recurringType != RecurringType.NONE) {
            desc += `Recurs ${RecurringType[event.recurringType]} on ${this.extractDaysString(event.recurringDays)}\n`;
        }
        if (event.postAt || event.postPrior || event.postMorning) {
            desc += `Will ping #${event.announcementChannel?.name} `;
            desc += ([[event.postMorning, 'at 8am'], [event.postPrior, '1hr prior'], [event.postAt, 'at event start']] as [boolean, string][])
                .filter(p => p[0])
                .map(p => p[1])
                .join(', ');
            desc += '\n';
        }
        desc += `Created by: ${event.createdBy?.toString()}`;
        return desc;
    }


    public validateCreate(partialEvent: IEventData): partialEvent is IEventDataComplete {
        return !!(partialEvent.name && 
            partialEvent.startDate &&
            partialEvent.duration &&
            this.validateRecurring(partialEvent));
    }

    private validateRecurring(partialEvent: IEventData): boolean {
        switch (partialEvent.recurringType) {
            case RecurringType.NONE:
                return true;
            case RecurringType.DAILY:
                return false;
            case RecurringType.WEEKLY:
                return !!partialEvent.recurringDays;
            case RecurringType.MONTHLY:
                return false;
            case RecurringType.YEARLY:
                return false;
            default:
                return false;
        }
    }
}
