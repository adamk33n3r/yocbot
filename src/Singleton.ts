export class Singleton {
    private static _instance: unknown;
    public static getInstance<T extends typeof Singleton>(this: T) {
        return this._instance as InstanceType<T>;
    }
    constructor() {
        Singleton._instance = this;
    }
}
