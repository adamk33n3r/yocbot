import { getApp } from 'firebase-admin/app';
import { Firestore, Query, QuerySnapshot, getFirestore } from 'firebase-admin/firestore';
import { IMovieData, Movie } from 'src/movienight/Movie';

type DBMovie = Movie & { id: string };

export class MovieService {
    private firestore: Firestore;
    private static _instance: MovieService;

    constructor() {
        this.firestore = getFirestore(getApp());
    }

    public static getInstance(): MovieService {
        if (MovieService._instance == null) {
            MovieService._instance = new MovieService();
        }
        return MovieService._instance;
    }

    public async getMovies(all: boolean = false): Promise<DBMovie[]> {
        let col = this.getCollection() as Query;
        if (!all) {
            col = col.where('watched', '==', false);
        }
        const query = await col.get() as QuerySnapshot<DBMovie>;
        return query.docs.map(snap => snap.data());
    }

    public async getMovie(id: string): Promise<Movie | undefined> {
        return (await this.getCollection().doc(id).get()).data();
    }

    public async createMovie(movie: Movie) {
        return this.getCollection().add(movie);
    }

    public async updateMovie(movie: Movie): Promise<Movie> {
        if (!movie.id) {
            throw new Error(`Cannot update movie '${movie.title}' without id`);
        }
        movie.updatedAt = new Date();
        await this.getCollection().doc(movie.id).update(movie.toFirestoreData());
        return movie;
    }

    public async deleteMovie(movie: Movie) {
        if (!movie.id) {
            throw new Error(`Cannot delete movie '${movie.title}' without id`);
        }
        return this.getCollection().doc(movie.id).delete();
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
        return this.firestore.collection('movies').withConverter<Movie>({
            toFirestore: (movie: Movie) => movie.toFirestoreData(),
            fromFirestore: (data) => new Movie({id: data.id, ...data.data() as IMovieData}),
        });
    }
}
