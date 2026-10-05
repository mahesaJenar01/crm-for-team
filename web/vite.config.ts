import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { gateway } from './lib/gateway.ts';

function apiPlugin(apiUrl: string | undefined): Plugin {
  const middleware = (server: Pick<ViteDevServer, 'middlewares'>) => {
    server.middlewares.use('/api', async (req, res) => {
      try {
        const parts: Buffer[] = [];
        let length = 0;
        for await (const part of req) {
          length += part.length;
          if (length > 64_000) {
            res.writeHead(413);
            res.end('{"error":"Permintaan terlalu besar."}');
            return;
          }
          parts.push(Buffer.from(part));
        }
        const headers = new Headers();
        for (const [name, value] of Object.entries(req.headers))
          if (value) headers.set(name, Array.isArray(value) ? value.join(',') : value);
        // Connect strips the /api prefix when mounting middleware.
        const request = new Request(`http://${req.headers.host}/api${req.url}`, {
          method: req.method,
          headers,
          body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : Buffer.concat(parts),
        });
        const response = await gateway(request, { apiUrl });
        res.statusCode = response.status;
        response.headers.forEach((value, name) => {
          if (name !== 'set-cookie') res.setHeader(name, value);
        });
        if (response.headers.getSetCookie().length)
          res.setHeader('set-cookie', response.headers.getSetCookie());
        res.end(await response.text());
      } catch {
        res.writeHead(500);
        res.end('{"error":"Tidak dapat menghubungi server."}');
      }
    });
  };
  return { name: 'crm-api', configureServer: middleware, configurePreviewServer: middleware };
}
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), apiPlugin(env.CRM_API_URL)],
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
  };
});
