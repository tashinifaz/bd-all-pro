// Gzip with Node's built-in zlib (no dependency). Static assets are compressed once and cached; HTML/JSON/CSV responses are compressed on send.
const zlib = require('zlib'), fs = require('fs'), path = require('path');
const pub = path.join(__dirname, '..', 'public');
const TYPES = { '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const cache = new Map(); // file -> {mtime, buf}
const wants = req => /\bgzip\b/.test(req.get('accept-encoding') || '');
module.exports = (req, res, next) => {
  if (!wants(req)) return next();
  // 1) static text assets (only .css/.js/.txt directly under /public or /public/vendor)
  if (req.method === 'GET' && /^\/(vendor\/)?[\w.-]+\.(css|js|txt)$/.test(req.path)) {
    const file = path.join(pub, req.path);
    if (!file.startsWith(pub + path.sep)) return next();
    try {
      const st = fs.statSync(file); let c = cache.get(file);
      if (!c || c.mtime !== st.mtimeMs) { c = { mtime: st.mtimeMs, buf: zlib.gzipSync(fs.readFileSync(file), { level: 9 }) }; cache.set(file, c); }
      res.set({ 'Content-Type': TYPES[path.extname(file)], 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding', 'Cache-Control': 'public, max-age=604800', 'Content-Length': c.buf.length });
      return res.end(req.method === 'HEAD' ? undefined : c.buf);
    } catch (e) { return next(); }
  }
  // 2) dynamic text responses over 1 KB
  const send = res.send;
  res.send = function (body) {
    if (typeof body === 'string' && body.length > 1024 && !res.getHeader('Content-Encoding')) {
      if (!res.getHeader('Content-Type')) res.type('html');
      res.set('Vary', 'Accept-Encoding').set('Content-Encoding', 'gzip');
      body = zlib.gzipSync(body);
    }
    return send.call(this, body);
  };
  next();
};
