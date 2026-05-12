export class Router {
    constructor() {
        this.routes = [];
    }

    add(method, path, handler) {
        const pattern = path
            .replace(/\//g, '\\/')
            .replace(/:(\w+)/g, '(?<$1>[^/]+)');
        const regex = new RegExp(`^${pattern}$`);
        this.routes.push({ method, regex, handler });
    }

    async handle(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        for (const route of this.routes) {
            if (route.method !== method && route.method !== 'ALL') continue;
            
            const match = path.match(route.regex);
            if (match) {
                const params = match.groups || {};
                return await route.handler(request, env, ctx, params);
            }
        }

        return null;
    }
}
