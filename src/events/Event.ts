import { GuildScheduledEvent, VoiceChannel, Snowflake, GuildMember, TextChannel } from 'discord.js';

import { Timestamp, DocumentData } from 'firebase-admin/firestore';
import { Bot } from 'src/Bot';

export enum RecurringType {
    NONE,
    DAILY,
    WEEKLY,
    MONTHLY,
    YEARLY,
}

export enum Days {
    NONE      = 0b0,
    SUNDAY    = 0b1,
    MONDAY    = 0b10,
    TUESDAY   = 0b100,
    WEDNESDAY = 0b1000,
    THURSDAY  = 0b10000,
    FRIDAY    = 0b100000,
    SATURDAY  = 0b1000000,
}

interface DiscordEventInfo {
    discordEventId: Snowflake;
    postMorningSent: boolean;
    postPriorSent: boolean;
    postAtSent: boolean;
}

export interface IEventData<P extends boolean = boolean> {
    id?: string;
    name: string;
    partial: P;
    description?: string;
    startDate?: Date | Timestamp;
    duration?: number;
    voiceChannelId: Snowflake;
    announcementChannelId: Snowflake;
    imageUrl?: string;
    createdById: Snowflake;
    createdAt: Date | Timestamp;
    updatedAt: Date | Timestamp;
    recurringType?: RecurringType;
    recurringDays?: number;
    postMorning?: boolean;
    postPrior?: boolean;
    postAt?: boolean;
    nextEvent?: DiscordEventInfo;
}

type IEventDataPartial = IEventData<true>;

type IEventDataOnce = Omit<Required<IEventData<false>>, 'endDate' | 'recurringDays' | 'nextEvent'> & {
    recurringType: RecurringType.NONE;
}
type IEventDataDaily = Omit<Required<IEventData<false>>, 'recurringDays'> & {
    recurringType: RecurringType.DAILY;
}
type IEventDataRecurring = Required<IEventData<false>> & {
    recurringType: RecurringType.WEEKLY | RecurringType.MONTHLY | RecurringType.YEARLY;
}

export type IEventDataComplete = IEventDataOnce | IEventDataDaily | IEventDataRecurring;
type RequiredButUndefined<T> = {
    [P in keyof Required<T>]: T[P];
};

export class Event implements IEventData {
    [idx: string]: any;
    public id?: string;
    public name: string;
    public partial: boolean;
    public description?: string;
    public startDate?: Date;
    public duration?: number;
    public voiceChannelId: Snowflake;
    public voiceChannel?: VoiceChannel;
    public announcementChannelId: Snowflake;
    public announcementChannel?: TextChannel;
    public imageUrl?: string;
    public createdById: Snowflake;
    public createdBy?: GuildMember;
    public createdAt: Date;
    public updatedAt: Date;
    public recurringType: RecurringType = RecurringType.NONE;
    public recurringDays: number = Days.NONE; // bitmask
    public postMorning: boolean = false;
    public postPrior: boolean = false;
    public postAt: boolean = true;
    public nextEvent?: DiscordEventInfo & {
        discordEvent?: GuildScheduledEvent;
    };

    private constructor(data: IEventData) {
        console.log('INSTANTIATE EVENT', data.id, data.name);
        this.id = data.id;
        this.name = data.name;
        this.partial = data.partial;
        this.description = data.description;
        this.startDate = data.startDate instanceof Timestamp ? data.startDate.toDate() : data.startDate;
        this.duration = data.duration;
        this.voiceChannelId = data.voiceChannelId;
        this.announcementChannelId = data.announcementChannelId;
        this.imageUrl = data.imageUrl;
        this.nextEvent = data.nextEvent;
        this.createdById = data.createdById;
        this.createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt;
        this.updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt;
        if (data.recurringType !== undefined)
            this.recurringType = data.recurringType;
        if (data.recurringDays !== undefined)
            this.recurringDays = data.recurringDays;
        if (data.postMorning !== undefined)
            this.postMorning = data.postMorning;
        if (data.postPrior !== undefined)
            this.postPrior = data.postPrior;
        if (data.postAt !== undefined)
            this.postAt = data.postAt;

        // this.loadDiscordEntities();
    }
    
    public static create(data: IEventData): Promise<Event> {
        return new Event(data).withDiscordEntities();
    }

    public static createRaw(data: IEventData): Event {
        return new Event(data);
    }

    private async loadDiscordEntities() {
        const promises = [];
        if (this.voiceChannelId)
            promises.push(Bot.getInstance().guild.channels.fetch(this.voiceChannelId).then(chan => this.voiceChannel = chan as VoiceChannel));
        if (this.announcementChannelId)
            promises.push(Bot.getInstance().guild.channels.fetch(this.announcementChannelId).then(chan => this.announcementChannel = chan as TextChannel));
        if (this.createdById)
            promises.push(Bot.getInstance().guild.members.fetch(this.createdById).then(user => this.createdBy = user));
        if (this.nextEvent)
            promises.push(Bot.getInstance().guild.scheduledEvents.fetch(this.nextEvent.discordEventId).then(event => this.nextEvent!.discordEvent = event));
        return Promise.allSettled(promises);
    }

    public async withDiscordEntities(): Promise<Event> {
        await this.loadDiscordEntities();
        return this;
    }
    
    public toFirestoreData(): DocumentData {
        const data: RequiredButUndefined<Omit<IEventData, 'id'>> = {
            name: this.name,
            partial: this.partial,
            description: this.description,
            startDate: this.startDate,
            duration: this.duration,
            voiceChannelId: this.voiceChannelId,
            announcementChannelId: this.announcementChannelId,
            imageUrl: this.imageUrl,
            createdById: this.createdById,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            recurringType: this.recurringType,
            recurringDays: this.recurringDays,
            postMorning: this.postMorning,
            postPrior: this.postPrior,
            postAt: this.postAt,
            nextEvent: this.nextEvent ? (({ discordEvent: _, ...data }) => data)(this.nextEvent) : undefined,
        };

        return data;
    }
}
