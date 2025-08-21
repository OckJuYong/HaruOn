// src/setupProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    ['/healthz', '/v1', '/docs', '/openapi.json'],
    createProxyMiddleware({
      target: 'http://54.180.8.10',
      changeOrigin: true,
      secure: false,
      logLevel: 'debug', // ← debug로 변경
      onProxyRes(proxyRes, req) {
        // 상태코드/경로 간단 로깅
        console.log('[proxy]', req.method, req.url, '→', proxyRes.statusCode);
      },
      onError(err, req, res) {
        console.error('[proxy error]', req.method, req.url, err?.message);
      },
    })
  );
};
