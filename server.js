/**
 * Sign Bridge - Local Web & HTTPS Server
 * Serves the speech-to-text assistive app with zero external dependencies (HTTP)
 * and automatic self-signed SSL (HTTPS) for mobile phones (Android / iOS).
 * 
 * Mobile browsers require HTTPS to allow Microphone and Web Speech API access.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HTTP_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const HTTPS_PORT = process.env.HTTPS_PORT ? parseInt(process.env.HTTPS_PORT, 10) : 8443;
const SECONDARY_PORT = 3000;

const CERT_PATH = path.join(__dirname, 'ssl_cert.pem');
const KEY_PATH = path.join(__dirname, 'ssl_key.pem');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=UTF-8'
};

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Find IPv4 non-internal address (Wi-Fi or Ethernet)
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function handleRequest(req, res) {
  let safePath = req.url.split('?')[0];
  if (safePath === '/' || safePath === '') {
    safePath = '/index.html';
  }

  // Prevent directory traversal
  const safeNormalized = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safeNormalized);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    }
  });
}

async function getOrCreateCertificates() {
  if (fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
    try {
      const cert = fs.readFileSync(CERT_PATH, 'utf8');
      const key = fs.readFileSync(KEY_PATH, 'utf8');
      if (cert.length > 50 && key.length > 50) {
        return { cert, key };
      }
    } catch (e) {
      console.warn('[Sign Bridge] Existing certificates invalid, regenerating...');
    }
  }

  try {
    const selfsigned = require('selfsigned');
    const localIp = getLocalIpAddress();
    const attrs = [
      { name: 'commonName', value: localIp },
      { name: 'organizationName', value: 'Connectiva Technologies' }
    ];
    const pems = await selfsigned.generate(attrs, {
      days: 365,
      keySize: 2048,
      algorithm: 'sha256'
    });

    fs.writeFileSync(CERT_PATH, pems.cert, 'utf8');
    fs.writeFileSync(KEY_PATH, pems.private, 'utf8');
    return { cert: pems.cert, key: pems.private };
  } catch (err) {
    console.warn('[Sign Bridge] Could not generate selfsigned SSL cert automatically:', err.message);
    return null;
  }
}

async function startServers() {
  const localIp = getLocalIpAddress();

  // 1. Start HTTP Server (for Computer localhost & fallback)
  const httpServer = http.createServer(handleRequest);
  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Sign Bridge] HTTP Port ${HTTP_PORT} is in use.`);
    } else {
      console.error(`[Sign Bridge] HTTP Server error:`, err.message);
    }
  });

  httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`  SIGN BRIDGE - Connectiva Technologies`);
    console.log(`  Real-Time Voice-to-Text for Deaf Individuals`);
    console.log(`=======================================================`);
    console.log(`💻 COMPUTER BROWSER:`);
    console.log(`   \x1b[32mhttp://localhost:${HTTP_PORT}\x1b[0m`);
    console.log(`-------------------------------------------------------`);
  });

  // 2. Start HTTPS Server (Required for Mobile Phones / Android / iPhone microphone)
  const certs = await getOrCreateCertificates();
  if (certs) {
    const httpsServer = https.createServer({
      key: certs.key,
      cert: certs.cert
    }, handleRequest);

    httpsServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Sign Bridge] HTTPS Port ${HTTPS_PORT} is in use.`);
      } else {
        console.error(`[Sign Bridge] HTTPS Server error:`, err.message);
      }
    });

    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
      console.log(`📱 CELLPHONE BROWSER (Android / iPhone on Wi-Fi):`);
      console.log(`   \x1b[36mhttps://${localIp}:${HTTPS_PORT}\x1b[0m   <-- USE THIS ON PHONES`);
      console.log(``);
      console.log(`   \x1b[33mNOTE FOR PHONES:\x1b[0m When opening for the first time,`);
      console.log(`   tap \x1b[1m"Advanced"\x1b[0m then \x1b[1m"Proceed to ${localIp} (unsafe)"\x1b[0m.`);
      console.log(`   This enables 100% microphone speech recognition on mobile!`);
      console.log(`=======================================================`);
    });
  } else {
    console.log(`📱 Cellphone HTTP: http://${localIp}:${HTTP_PORT}`);
    console.log(`=======================================================`);
  }

  // Also start secondary port if requested and distinct
  if (HTTP_PORT !== SECONDARY_PORT) {
    const secondaryServer = http.createServer(handleRequest);
    secondaryServer.on('error', () => {});
    secondaryServer.listen(SECONDARY_PORT, '0.0.0.0');
  }
}

startServers();

