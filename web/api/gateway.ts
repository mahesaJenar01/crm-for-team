import { gateway } from '../lib/gateway.js';

export default { fetch: (request: Request) => gateway(request) };
