import { ChatInputCommandInteraction } from 'discord.js';
import { Bot } from 'src/Bot';
import { MovieService } from 'src/database/MovieService';
import { Movie } from 'src/movienight/Movie';
import { MovieListMessageBuilder } from 'src/movienight/MovieListMessageBuilder';
import { AutocompleteFunc } from 'src/SlashCommand';
import { SlashCommand, SlashCommandGroup, SlashCommandOption } from 'src/types/CommandDecorators';
import fuzzysort from 'fuzzysort';

const autocomplete: AutocompleteFunc = async (interaction) => {
    const partialName = interaction.options.getFocused().toLowerCase();
    const movies = await MovieService.getInstance().getMovies();
    const filteredMovies = movies.filter(m => m.title.toLowerCase().includes(partialName) || m.id.toLowerCase().startsWith(partialName));
    const fuzzy = fuzzysort.go(partialName, filteredMovies, {
        limit: 10,
        keys: ['title', 'id'],
    });
    const data = fuzzy
        .toSorted((a, b) => b.score - a.score || a.obj.title.localeCompare(b.obj.title, undefined, { numeric: true, sensitivity: 'base' }))
        .map(m => ({ name: `${m.obj.title} - ${m.obj.id}`, value: m.obj.id }));
    return interaction.respond(data);
};

@SlashCommandGroup({
    name: 'movies',
    description: 'Commands to manage movies for movienight',
})
export abstract class Movienight {
    @SlashCommand()
    public async add(
        @SlashCommandOption({
            name: 'title',
            description: 'Title of the movie',
        })
        title: string,
        bot: Bot,
        interaction: ChatInputCommandInteraction,
    ) {
        const movies = await MovieService.getInstance().getMovies(true);
        if (movies.some(m => m.title.toLowerCase().startsWith(title.toLowerCase()))) {
            return interaction.followUp('Either that movie is already added (and maybe marked as watched), or you need to add a subtitle to differentiate');
        }
        const movie = new Movie({ title, createdBy: interaction.user.id });
        movie.votes.push(interaction.user.id);
        await MovieService.getInstance().createMovie(movie);
        return interaction.followUp('Movie added');
    }

    @SlashCommand()
    public async remove(
        @SlashCommandOption({
            name: 'title',
            description: 'Title of the movie',
            autocomplete,
        })
        id: string,
        bot: Bot,
        interaction: ChatInputCommandInteraction,
    ) {
        const movie = await MovieService.getInstance().getMovie(id);
        if (!movie) {
            return interaction.followUp(`Could not find movie with id: ${id}`);
        }

        if (movie.votes.length > 1 || movie.createdBy !== interaction.user.id) {
            return interaction.followUp('You can only remove movies added by you and if nobody else has voted for it');
        }

        await MovieService.getInstance().deleteMovie(movie);
        return interaction.followUp(`Removed movie ${movie.title}`);
    }

    @SlashCommand()
    public async watched(
        @SlashCommandOption({
            name: 'title',
            description: 'Title of the movie',
            autocomplete,
        })
        id: string,
        bot: Bot,
        interaction: ChatInputCommandInteraction,
    ) {
        const movie = await MovieService.getInstance().getMovie(id);
        if (!movie) {
            return interaction.followUp(`Could not find movie with id: ${id}`);
        }

        movie.watched = true;
        await MovieService.getInstance().updateMovie(movie);
        return interaction.followUp(`Set movie ${movie.title} to watched`);
    }

    @SlashCommand({
        description: 'Vote on a movie',
    })
    public async vote(
        @SlashCommandOption({
            name: 'title',
            description: 'Title of the movie',
            autocomplete,
        })
        id: string,
        bot: Bot,
        interaction: ChatInputCommandInteraction,
    ) {
        const movie = await MovieService.getInstance().getMovie(id);
        if (!movie) {
            return interaction.followUp(`Could not find movie with id: ${id}`);
        }

        if (movie.votes.indexOf(interaction.user.id) >= 0) {
            return interaction.followUp('You already voted for this movie ;)');
        }

        movie.votes.push(interaction.user.id);
        await MovieService.getInstance().updateMovie(movie);
        return interaction.followUp(`Added vote for ${movie.title}`);
    }
    @SlashCommand({
        description: 'Top 5 movies',
    })
    public async top(
        @SlashCommandOption({
            name: 'number',
            description: 'Number of movies to show',
            required: false,
        })
        number: number,
        bot: Bot,
        interaction: ChatInputCommandInteraction,
    ) {
        const movies = await MovieService.getInstance().getMovies();
        if (!movies.length) {
            return interaction.followUp('There are no movies');
        }

        const sorted = movies.sort((a, b) => (b.votes.length - a.votes.length) || (a.createdAt.getTime() - b.createdAt.getTime()))
            .slice(0, number ?? 5);

        return interaction.followUp(MovieListMessageBuilder.buildMessage(sorted, false, interaction.user));
    }

    @SlashCommand({
        description: 'List movies',
    })
    public async list(
        @SlashCommandOption({
            name: 'all',
            description: 'Show all movies, including watched',
            required: false,
        })
        all: boolean,
        bot: Bot,
        interaction: ChatInputCommandInteraction,
    ) {
        const movies = await MovieService.getInstance().getMovies(all ?? false);
        if (!movies.length) {
            return interaction.followUp('There are no movies');
        }

        return interaction.followUp(MovieListMessageBuilder.buildMessage(movies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()), all, interaction.user));
    }
}
