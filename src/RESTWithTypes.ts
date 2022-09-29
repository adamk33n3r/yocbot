import { RequestData, REST, RouteLike } from 'discord.js';

export class RESTWithTypes extends REST {
    put<T>(fullRoute: RouteLike, options?: RequestData): Promise<T> {
        return super.put(fullRoute, options) as Promise<T>;
    }

    delete<T>(fullRoute: RouteLike, options?: RequestData): Promise<T> {
        return super.delete(fullRoute, options) as Promise<T>;
    }
}
