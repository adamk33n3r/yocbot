import { SlashCommand, SlashCommandOption } from './SlashCommand';

interface SlashCommandMetadata {
    target: Record<string, unknown>;
    key: string;
    slashCommand: SlashCommand;
}
interface SlashCommandOptionsMetadata {
    target: Record<string, unknown>;
    key: string;
    slashCommandOption: SlashCommandOption;
}

export class MetadataManager {
    private _slashCommands: SlashCommandMetadata[] = [];
    private _slashCommandsOptions: SlashCommandOptionsMetadata[] = [];
    public get slashCommands(): SlashCommand[] {
        return this._slashCommands.map(scm => scm.slashCommand);
    }

    private static _instance: MetadataManager;
    public static get instance(): MetadataManager {
        if (!this._instance) {
            this._instance = new MetadataManager();
        }
        return this._instance;
    }

    private constructor() {
        this._slashCommands = [];
    }

    // This is called AFTER command options
    public addSlashCommand(target: Record<string, unknown>, key: string, slashCommand: SlashCommand) {
        this._slashCommandsOptions.filter(sco => sco.target === target && sco.key === key).forEach(sco => {
            slashCommand.addOption(sco.slashCommandOption);
        });
        this._slashCommands.push({ target, key, slashCommand });
    }

    public addSlashCommandOption(target: Record<string, unknown>, key: string, slashCommandOption: SlashCommandOption) {
        this._slashCommandsOptions.push({ target, key, slashCommandOption });
    }
}
