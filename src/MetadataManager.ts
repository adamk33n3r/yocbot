import { Collection } from 'discord.js';
import type { SlashCommandCollection, SlashCommandGroup } from './SlashCommandGroup';

type SlashCommandGroupCollection = Collection<string, SlashCommandGroup>;

export class MetadataManager {
    private _slashCommandGroups: SlashCommandGroupCollection = new Collection();
    public get slashCommands(): SlashCommandCollection {
        return this._slashCommandGroups.flatMap(scg => scg.commands);
    }
    public get slashCommandGroups(): SlashCommandGroupCollection {
        return new Collection(this._slashCommandGroups);
    }

    private static _instance: MetadataManager;
    public static get instance(): MetadataManager {
        if (!this._instance) {
            this._instance = new MetadataManager();
        }
        return this._instance;
    }

    public addSlashCommandGroup(slashCommandGroup: SlashCommandGroup) {
        this._slashCommandGroups.set(slashCommandGroup.name, slashCommandGroup);
    }
}
