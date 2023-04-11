import { Snowflake } from 'discord.js';
import { DocumentData } from 'firebase-admin/firestore';

export interface IMovieData {
    id?: string;
    title: string;
    watched?: boolean;
    plexUrl?: string;
    imgUrl?: string;
    createdAt?: Date;
    updatedAt?: Date;
    votes?: Snowflake[];
}

export class Movie {
    public id?: string;
    public title: string;
    public watched: boolean;
    public plexUrl?: string;
    public imgUrl?: string;
    public createdAt: Date;
    public updatedAt: Date;
    public votes: Snowflake[];

    constructor(data: IMovieData) {
        this.id = data.id;
        this.title = data.title;
        this.watched = data.watched || false;
        this.plexUrl = data.plexUrl;
        this.imgUrl = data.imgUrl;
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
        this.votes = data.votes || [];
    }

    public toFirestoreData(): DocumentData {
        return {
            title: this.title,
            watched: this.watched,
            plexUrl: this.plexUrl,
            imgUrl: this.imgUrl,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            votes: this.votes,
        };
    }
}
