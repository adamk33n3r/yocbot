import yargs from 'yargs/yargs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { MovieService } from '../database/MovieService';

const argv = yargs(process.argv.slice(2)).options({
    testbot: { type: 'boolean', default: false },
}).parseSync();

if (argv.testbot) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = 'C:\\Users\\adamg\\SynologyDrive\\Files\\dev\\discordbot\\src\\.firestore-creds.json';
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
}

initializeApp({
    credential: applicationDefault(),
});
getFirestore().settings({
    ignoreUndefinedProperties: true,
});
const movies = await MovieService.getInstance().getMovies(true);

await Promise.all(movies.map(movie => {
    movie.createdBy = movie.votes[0];
    return MovieService.getInstance().updateMovie(movie);
}));
