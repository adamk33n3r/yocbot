import { readdirSync } from 'fs';
import path from 'path';

export class CommandLoader {
    private get endsWith(): string {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (process as any)[Symbol.for('ts-node.register.instance')] ? '.ts' : '.js';
    }

    private commandPaths: string[];

    constructor(...commandPaths: string[]) {
        this.commandPaths = commandPaths;
    }

    public load(fileName: string): void {
        this.commandPaths.flatMap((commandPath) => {
            const commandFiles = readdirSync(path.join(__dirname, commandPath))
                .filter(file => file === `${fileName}${this.endsWith}`);
            return commandFiles.map(file => {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                return require(`./${commandPath}/${file}`).default;
            });
        });
    }

    public loadAll(): void {
        this.commandPaths.flatMap((commandPath) => {
            const commandFiles = readdirSync(path.join(__dirname, commandPath))
                .filter(file => file.endsWith(this.endsWith));
            return commandFiles.map(file => {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                return require(`./${commandPath}/${file}`).default;
            });
        });
    }

}
