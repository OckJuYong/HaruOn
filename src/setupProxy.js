const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/functions', // Proxy requests to /functions
    createProxyMiddleware({
      target: process.env.REACT_APP_SUPABASE_URL, // Use Supabase URL from env
      changeOrigin: true,
      secure: false, // Allow self-signed certs for local dev if needed
      logLevel: 'debug',
      onProxyRes(proxyRes, req) {
        console.log('[proxy]', req.method, req.url, '→', proxyRes.statusCode);
      },
      onError(err, req, res) {
        console.error('[proxy error]', req.method, req.url, err?.message);
      },
    })
  );
};