const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const port = Number(process.env.PORT || 3000);

const server = http.createServer((req, res) => {
  const requested = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = path.normalize(path.join(root, requested === '/' ? 'manifest.json' : requested));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404); return res.end('Not found'); }
    const type = file.endsWith('.json') ? 'application/json' : 'application/javascript';
    res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Access-Control-Allow-Origin': '*' });
    res.end(data);
  });
});
server.listen(port, '0.0.0.0', () => console.log(`Nuvio manifest server listening on ${port}`));
