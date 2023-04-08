import { Attachment, ChatInputCommandInteraction, VoiceChannel, ApplicationCommandOptionType, TextChannel, Role } from 'discord.js';
import { Bot } from 'src/Bot';
import { EventManager } from 'src/events/EventManager';
import { EventMessageBuilder } from 'src/events/EventMessageBuilder';
import logger from 'src/Logger';
import { SlashCommand, SlashCommandGroup, SlashCommandOption } from 'src/types/CommandDecorators';

@SlashCommandGroup({
    name: 'event',
    description: 'Commands to schedule and manage events',
})
export abstract class EventCommands {
    // private constructor() {}
    @SlashCommand({
        description: 'Create an event',
    })
    public async create(
        @SlashCommandOption({
            name: 'name',
            description: 'name of event',
            required: true,
        })
        eventName: string,
        @SlashCommandOption({
            name: 'voice_channel',
            description: 'Voice channel event is in',
            required: true,
        })
        voiceChannel: VoiceChannel,
        @SlashCommandOption({
            name: 'announce_channel',
            description: 'Channel to post about the event in',
            required: true,
        })
        announceChannel: TextChannel,
        @SlashCommandOption({
            name: 'ping_role',
            description: 'An optional role to ping on announcements',
            required: false,
            type: ApplicationCommandOptionType.Role,
        })
        pingRole: Role | undefined,
        @SlashCommandOption({
            name: 'description',
            description: 'description of event',
            required: false,
            type: ApplicationCommandOptionType.String,
        })
        description: string | undefined,
        @SlashCommandOption({
            name: 'image',
            description: 'cover image',
            required: false,
            type: ApplicationCommandOptionType.Attachment,
        })
        image: Attachment | undefined,
        bot: Bot,
        interaction: ChatInputCommandInteraction,
    ) {
        const partialEvent = await EventManager.getInstance().createEvent({
            name: eventName,
            description,
            voiceChannel: voiceChannel.id,
            announcementChannel: announceChannel.id,
            pingRole: pingRole?.id,
            image: image?.proxyURL,
            createdBy: interaction.user.id,
        });
        logger.info('created event:', partialEvent.toFirestoreData());

        return interaction.followUp(EventMessageBuilder.buildMessage(partialEvent));
    }

    @SlashCommand({
        description: 'Manage an event',
    })
    public async manage(
        @SlashCommandOption({
            name: 'name',
            description: 'Name of event',
            required: true,
            autocomplete: async (interaction) => {
                const partialName = interaction.options.getFocused();
                const events = await EventManager.getInstance().getEvents();
                const data = events
                    .filter(e => e.name.startsWith(partialName) || e.id.startsWith(partialName))
                    .map(e => ({ name: `${e.name} - ${e.id}`, value: e.id }));
                return interaction.respond(data);
            },
        })
        id: string,
        bot: Bot,
        interaction: ChatInputCommandInteraction,
    ) {
        const event = await EventManager.getInstance().getEvent(id);
        if (!event) {
            return interaction.followUp(`Could not find event with id: ${id}`);
        }
        return interaction.followUp(EventMessageBuilder.buildMessage(event));
    }
}
