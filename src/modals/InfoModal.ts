import { ActionRowBuilder, ModalBuilder, ModalSubmitInteraction, TextInputBuilder, TextInputStyle } from 'discord.js';
import { IEventData } from '../events/Event';
import { DiscordModal as BaseModal } from './DiscordModal';

export class InfoModal extends BaseModal {
    public get modal(): ModalBuilder {
        return this._modal;
    }

    private _modal: ModalBuilder;
    constructor(partialEvent: IEventData) {
        super();
        this._modal = new ModalBuilder()
            .setTitle('Schedule')
            .setCustomId(`schedule:modal:info:${partialEvent.id}`)
            .setComponents(
                new ActionRowBuilder<TextInputBuilder>()
                    .setComponents(
                        new TextInputBuilder()
                            .setCustomId('name')
                            .setLabel('Name')
                            .setPlaceholder('Name of the event')
                            .setValue(partialEvent.name)
                            .setStyle(TextInputStyle.Short)
                            .setMaxLength(100)
                            .setRequired(true),
                    ),
                new ActionRowBuilder<TextInputBuilder>()
                    .setComponents(
                        new TextInputBuilder()
                            .setCustomId('description')
                            .setLabel('Description')
                            .setPlaceholder('Description of the event')
                            .setValue(partialEvent.description ?? '')
                            .setStyle(TextInputStyle.Paragraph)
                            .setMaxLength(1000)
                            .setRequired(false),
                    ),
            );
    }

    public static processData(partialEvent: IEventData, mobileSubmitInteraction: ModalSubmitInteraction) {
        partialEvent.name = mobileSubmitInteraction.fields.getTextInputValue('name');
        partialEvent.description = mobileSubmitInteraction.fields.getTextInputValue('description');
    }
}
