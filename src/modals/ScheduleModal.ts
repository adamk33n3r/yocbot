import { ActionRowBuilder, ModalBuilder, ModalSubmitInteraction, TextInputBuilder, TextInputStyle } from 'discord.js';
import { Event, IEventData } from '../events/Event';
import { DiscordModal as BaseModal } from './DiscordModal';
import { format } from 'date-fns';

export class ScheduleModal extends BaseModal {
    public get modal(): ModalBuilder {
        return this._modal;
    }

    private _modal: ModalBuilder;
    constructor(partialEvent: Event) {
        super();
        const startDate = new TextInputBuilder()
            .setCustomId('startDate')
            .setLabel('Start Date')
            .setPlaceholder('mm/dd/yy')
            .setStyle(TextInputStyle.Short)
            .setMinLength(8)
            .setMaxLength(8)
            .setRequired(true);
        if (partialEvent.startDate)
            startDate.setValue(format(partialEvent.startDate, 'MM/dd/yy'));

        const startTime = new TextInputBuilder()
            .setCustomId('startTime')
            .setLabel('Start Time')
            .setPlaceholder('hh:mm')
            .setStyle(TextInputStyle.Short)
            .setMinLength(5)
            .setMaxLength(5)
            .setRequired(true);
        if (partialEvent.startDate)
            startTime.setValue(format(partialEvent.startDate, 'HH:mm'));

        const duration = new TextInputBuilder()
            .setCustomId('duration')
            .setLabel('Duration (minutes)')
            .setPlaceholder('60')
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(3)
            .setRequired(true);
        if (partialEvent.duration)
            duration.setValue(partialEvent.duration.toString());

        this._modal = new ModalBuilder()
            .setTitle('Schedule')
            .setCustomId(`schedule:modal:schedule:${partialEvent.id}`)
            .setComponents(
                new ActionRowBuilder<TextInputBuilder>()
                    .setComponents(startDate),
                new ActionRowBuilder<TextInputBuilder>()
                    .setComponents(startTime),
                new ActionRowBuilder<TextInputBuilder>()
                    .setComponents(duration),
            );
    }

    public static processData(partialEvent: IEventData, mobileSubmitInteraction: ModalSubmitInteraction) {
        const startDate = mobileSubmitInteraction.fields.getTextInputValue('startDate');
        const startTime = mobileSubmitInteraction.fields.getTextInputValue('startTime');
        partialEvent.startDate = new Date(Date.parse(`${startDate} ${startTime}`));
        partialEvent.duration = Number.parseInt(mobileSubmitInteraction.fields.getTextInputValue('duration'));
    }
}
