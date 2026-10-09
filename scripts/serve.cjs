const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
function createServer() {
    return http.createServer((req, res) => {
        let name;
        try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
        catch { res.writeHead(400).end(); return; }
        const parts = name.split('/');
        if (parts.some(p => p.startsWith('.') || p === 'node_modules')) { res.writeHead(403).end(); return; }
        const file = path.join(root, name === '/' ? 'index.html' : name);
        if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        fs.stat(file, (err, stat) => {
            if (err || !stat.isFile()) { res.writeHead(404).end(); return; }
            res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
            fs.createReadStream(file).pipe(res);
        });
    });
}
if (require.main === module) {
    const port = Number(process.env.PORT || 4173);
    createServer().listen(port, '127.0.0.1', function () { console.log(`http://127.0.0.1:${this.address().port}`); });
}
module.exports = { createServer };
