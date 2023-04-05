import { getApp } from 'firebase-admin/app';
import { Firestore, getFirestore, Query, QuerySnapshot, QueryDocumentSnapshot, Timestamp } from 'firebase-admin/firestore';
import { Event, IEventData, IEventDataComplete } from 'src/events/Event';

export class EventService {
    private firestore: Firestore;
    private static _instance: EventService;

    constructor() {
        this.firestore = getFirestore(getApp());
    }

    public static getInstance(): EventService {
        if (EventService._instance == null) {
            EventService._instance = new EventService();
        }
        return EventService._instance;
    }

    public getEvents(raw: true): Promise<QueryDocumentSnapshot<(Event & IEventDataComplete)>[]>;
    public getEvents(raw: false): Promise<(Event & IEventDataComplete)[]>;
    public getEvents(): Promise<(Event & IEventDataComplete)[]>;
    public async getEvents(raw: boolean = false): Promise<(Event & IEventDataComplete)[] | QueryDocumentSnapshot<(Event & IEventDataComplete)>[]> {
        const query = await this.getCollection().where('partial', '==', false).get() as QuerySnapshot<(Event & IEventDataComplete)>;
        return raw ? query.docs : Promise.all(query.docs.map(async snap => await snap.data().withDiscordEntities() as (Event & IEventDataComplete)));
    }

    public async getEvent(id: string): Promise<Event | undefined> {
        return (await this.getCollection().doc(id).get()).data()?.withDiscordEntities();
    }

    public async getEventByDiscordEvent(id: string): Promise<Event | undefined> {
        return (await this.getCollection().where('discordEventId', '==', id).limit(1).get()).docs[0].data();
    }

    public async createEvent(event: Event) {
        return this.getCollection().add(event);
    }

    public async updateEvent(event: Event): Promise<Event> {
        if (!event.id) {
            throw new Error(`Cannot update event '${event.name}' without id`);
        }
        event.updatedAt = new Date();
        await this.getCollection().doc(event.id).update(event.toFirestoreData());
        return event.withDiscordEntities();
    }

    public async deleteEvent(event: Event) {
        if (!event.id) {
            throw new Error(`Cannot delete event '${event.name}' without id`);
        }
        return this.getCollection().doc(event.id).delete();
    }

    public async deleteAll() {
        const query = this.getCollection().limit(500);
        const next = async (): Promise<void> => {
            const finished = await this.deleteBatch(query);
            if (finished) {
                return;
            }
            return next();
        };
        return next();
    }

    private async deleteBatch(query: Query) {
        const snapshot = await query.get();
        if (snapshot.size === 0) {
            return true;
        }

        const batch = this.firestore.batch();
        snapshot.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        return false;
    }

    private getCollection() {
        return this.firestore.collection('events').withConverter<Event>({
            toFirestore: (event: Event) => event.toFirestoreData(),
            fromFirestore: (data) => Event.createRaw({ id: data.id, ...data.data() as IEventData}),
        });
    }
}
