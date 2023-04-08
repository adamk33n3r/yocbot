import type { SlashCommand } from './SlashCommand';
import type { SlashCommandGroup } from './SlashCommandGroup';

export class MetadataManager {
    private _slashCommandGroups: SlashCommandGroup[] = [];
    public get slashCommands(): SlashCommand[] {
        return this._slashCommandGroups.flatMap(scg => scg.commands);
    }
    public get slashCommandGroups(): SlashCommandGroup[] {
        return this._slashCommandGroups.slice();
    }

    private static _instance: MetadataManager;
    public static get instance(): MetadataManager {
        if (!this._instance) {
            this._instance = new MetadataManager();
        }
        return this._instance;
    }

    public addSlashCommandGroup(slashCommandGroup: SlashCommandGroup) {
        this._slashCommandGroups.push(slashCommandGroup);
    }
}
