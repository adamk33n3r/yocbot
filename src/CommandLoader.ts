import { readdirSync } from 'fs';
import path from 'path';

export class CommandLoader {
    private commandPaths: string[];
    constructor(...commandPaths: string[]) {
        this.commandPaths = commandPaths;
    }

    public load(fileName: string): void {
        this.commandPaths.flatMap((commandPath) => {
            const commandFiles = readdirSync(path.join(__dirname, commandPath))
                .filter(file => file === `${fileName}.ts`);
            return commandFiles.map(file => {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                return require(`./${commandPath}/${file}`).default;
            });
        });
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

}
