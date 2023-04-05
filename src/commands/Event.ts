import { Attachment, ChatInputCommandInteraction, VoiceChannel, ApplicationCommandOptionType, TextChannel } from 'discord.js';
import { Bot } from 'src/Bot';
import { EventManager } from 'src/events/EventManager';
import { EventMessageBuilder } from 'src/events/EventMessageBuilder';
import logger from 'src/Logger';
import { SlashCommand, SlashCommandOption } from 'src/types/CommandDecorators';

export abstract class EventCommands {
    @SlashCommand({
        description: 'Create an event',
    })
    public async schedule(
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
            image: image?.proxyURL,
            createdBy: interaction.user.id,
        });
        logger.info('created event:', partialEvent);

        return interaction.followUp(EventMessageBuilder.buildMessage(partialEvent));
    }
}
