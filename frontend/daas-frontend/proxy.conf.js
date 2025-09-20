const PROXY_CONFIG = {
  "/api": {
    "target": "http://localhost:5001",
    "secure": false,
    "ws": true,
    "logLevel": "debug",
    "changeOrigin": true,
    "onProxyReq": function(proxyReq, req, res) {
      // This will log all standard HTTP requests
      console.log(`[PROXY] HTTP Request: ${req.method} ${req.url}`);
    },
    "onProxyReqWs": function(proxyReq, req, socket, options, head) {
      // This will log WebSocket upgrade requests
      console.log(`[PROXY] WebSocket Upgrade Request: ${req.url}`);
    },
    "onError": function(err, req, res) {
      console.error('[PROXY] Error: ', err);
    }
  }
};

module.exports = PROXY_CONFIG;