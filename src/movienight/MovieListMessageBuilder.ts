import { ActionRowBuilder, BaseMessageOptions, ButtonBuilder, ButtonStyle, MessageActionRowComponentBuilder } from 'discord.js';
import { Movie } from './Movie';

const MOVIES_PER_PAGE = 10;

export class MovieListMessageBuilder {
    public static buildMessage(movies: Movie[], all: boolean, pageNum: number = 0): BaseMessageOptions {
        const numPages = Math.ceil(movies.length / MOVIES_PER_PAGE);
        if (pageNum === -1) {
            pageNum = numPages - 1;
        }
        const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId('movielist:start' + (all ? ':all' : ''))
                    .setDisabled(pageNum === 0)
                    .setEmoji('⏮️'),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId(`movielist:${pageNum - 1}` + (all ? ':all' : ''))
                    .setDisabled((pageNum - 1) < 0)
                    .setEmoji('◀'),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId(`movielist:${pageNum + 1}` + (all ? ':all' : ''))
                    .setDisabled((pageNum + 1) >= numPages)
                    .setEmoji('▶'),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId('movielist:end' + (all ? ':all' : ''))
                    .setDisabled(pageNum === numPages - 1)
                    .setEmoji('⏭️'),
            ),
        ];

        const start = MOVIES_PER_PAGE * pageNum;
        const listStr = movies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .slice(start, start + MOVIES_PER_PAGE)
            .reduce((str, m, idx) => `${str}${idx + 1}. ${m.title} - ${m.votes.length}${m.watched ? ' ✅' : ''}\n`, '```\n') + '```';

        return { content: `**Movie List**\nPage ${pageNum + 1} / ${numPages}\n` + listStr, components };
    }
}
