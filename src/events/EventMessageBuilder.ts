import { formatDuration, intervalToDuration } from 'date-fns';
import { ActionRowBuilder, MessageActionRowComponentBuilder, BaseMessageOptions, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, RoleSelectMenuBuilder } from 'discord.js';
import { Event, RecurringType, Days } from './Event';
import { EventManager } from './EventManager';

function formattedDuration(minutes: number) {
    return formatDuration(intervalToDuration({
        start: new Date(0),
        end: new Date(minutes * 60 * 1000),
    }));
}

export enum EventMessageMode {
    EMBED_ONLY,
    CREATE,
    EDIT,
}

export class EventMessageBuilder {
    public static buildMessage(partialEvent: Event, mode: EventMessageMode): BaseMessageOptions {
        if (mode === EventMessageMode.EDIT && partialEvent.partial) {
            mode = EventMessageMode.CREATE;
        }
        let recurringDays: string = '';
        // Object.entries(Days).filter(([k, _]) => typeof Days[k as keyof typeof Days] === 'number')
        Object.entries(Days).filter(([_, v]) => typeof v === 'number')
            .map(([k, v]) => [k, v] as [string, Days])
            .forEach(([k, v]) => {
                if (partialEvent.recurringDays & v) {
                    recurringDays += k[0];
                    if (v & Days.THURSDAY || v & Days.SATURDAY)
                        recurringDays += k[1];
                }
            });

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(partialEvent.name)
            .setDescription(partialEvent.description || null)
            .addFields(
                { name: 'Start Date', value: partialEvent.startDate ? `<t:${partialEvent.startDate.getTime()/1000}:F>` : 'Not set', inline: true },
                { name: 'Voice Channel', value: '#!'+partialEvent.voiceChannel?.name ?? 'Not set', inline: true },
                { name: 'Announcement Channel', value: '#'+partialEvent.announcementChannel?.name ?? 'Not set', inline: true },
                { name: 'Duration', value: partialEvent.duration ? formattedDuration(partialEvent.duration) : 'Not set', inline: true },
                { name: 'Recurring Type', value: RecurringType[partialEvent.recurringType], inline: true },
                { name: 'Recurring Days', value: recurringDays || 'Not set', inline: true },
                { name: 'Post Morning', value: partialEvent.postMorning.toString(), inline: true },
                { name: 'Post Prior', value: partialEvent.postPrior.toString(), inline: true },
                { name: 'Post At', value: partialEvent.postAt.toString(), inline: true },
                { name: 'Ping Role', value: partialEvent.pingRole?.toString() ?? 'Not set', inline: true },
            );

        const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
        if (mode !== EventMessageMode.EMBED_ONLY) {
            components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`schedule:recurringType:${partialEvent.id}`)
                    .setPlaceholder('Recurring Interval')
                    .setOptions(
                        {
                            value: RecurringType.NONE + '',
                            label: 'None',
                        },
                        {
                            value: RecurringType.WEEKLY + '',
                            label: 'Weekly',
                        },
                    ),
            ));
            if (partialEvent.recurringType === RecurringType.WEEKLY) {
                components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`schedule:recurringDays:${partialEvent.id}`)
                        .setPlaceholder('Recurring Days')
                        .setMinValues(1)
                        .setMaxValues(7)
                        .setOptions(Object.entries(Days).filter(([k, _]) => typeof Days[k as keyof typeof Days] === 'number').map(([k, v]) => ({ label: k, value: v + '' }))),
                ));
            }
            components.push(new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId(`schedule:pingRole:${partialEvent.id}`)
                    .setMinValues(0)
                    .setMaxValues(1)
                    .setPlaceholder('Ping Role'),
            ));
            components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setStyle(partialEvent.postMorning ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setCustomId(`schedule:toggle:postMorning:${partialEvent.id}`)
                    .setLabel('Post Morning Of (8am)')
                    .setEmoji('☀️'),
                new ButtonBuilder()
                    .setStyle(partialEvent.postPrior ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setCustomId(`schedule:toggle:postPrior:${partialEvent.id}`)
                    .setLabel('Post Prior (1hr)')
                    .setEmoji('⌛'),
                new ButtonBuilder()
                    .setStyle(partialEvent.postAt ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setCustomId(`schedule:toggle:postAt:${partialEvent.id}`)
                    .setLabel('Post At Start')
                    .setEmoji('⏰'),
            ));
            components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId(`schedule:modal:info:${partialEvent.id}`)
                    .setLabel('Info')
                    .setEmoji('ℹ️'),
                new ButtonBuilder()
                    .setStyle(partialEvent.startDate && partialEvent.duration ? ButtonStyle.Success : ButtonStyle.Danger)
                    .setCustomId(`schedule:modal:schedule:${partialEvent.id}`)
                    .setLabel('Schedule')
                    .setEmoji('📅'),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId(`schedule:cancel:${partialEvent.id}`)
                    .setLabel(mode === EventMessageMode.EDIT ? 'Delete' : 'Cancel')
                    .setEmoji('❌'),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Success)
                    .setCustomId(`schedule:create:${partialEvent.id}`)
                    .setLabel(mode === EventMessageMode.EDIT ? 'Update' : 'Create')
                    .setDisabled(!EventManager.getInstance().validateCreate(partialEvent))
                    .setEmoji('✅'),
            ));
        }

        // Can use this after we finalize the event, or even before. Link to yoc.gg to edit the event on the website
        // new ButtonBuilder()
        //     .setStyle(ButtonStyle.Link)
        //     .setLabel('Create')
        //     .setURL('https://yoc.gg/events/37482405992438273');

        return { content: (mode === EventMessageMode.EMBED_ONLY ? '**Event Scheduled!**' : '**Schedule Event**') + `: ${partialEvent.id}`, components, embeds: [embed] };
    }
}
