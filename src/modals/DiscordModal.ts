import { ModalBuilder } from 'discord.js';

export abstract class DiscordModal {
    public abstract get modal(): ModalBuilder;
}
