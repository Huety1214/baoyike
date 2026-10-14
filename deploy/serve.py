from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'dist'

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def do_GET(self):
        if self.path.split('?')[0] == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"ok":true,"app":"life-quest"}')
            return
        if self.path.split('?')[0] == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()

if __name__ == '__main__':
    print('Life Quest listening on http://127.0.0.1:8390', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8390), Handler).serve_forever()
