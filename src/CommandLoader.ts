import { readdirSync, readFileSync, readSync } from 'fs';
import path from 'path';
import { SlashCommand } from 'src/SlashCommand';

export class CommandLoader {
    private commandPaths: string[];
    constructor(...commandPaths: string[]) {
        this.commandPaths = commandPaths;
    }

    public loadAll(): void {
        this.commandPaths.flatMap((commandPath) => {
            const commandFiles = readdirSync(path.join(__dirname, commandPath))
                .filter(file => file.endsWith('.ts'));
            return commandFiles.map(file => {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                return require(`./${commandPath}/${file}`).default;
            });
        });
    }

    public loadCommand(commandPath: string): SlashCommand {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(path.join(__dirname, commandPath));
        console.log(__dirname, commandPath, mod);
        return mod.default;
    }

}
