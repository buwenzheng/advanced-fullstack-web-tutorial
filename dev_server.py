import http.server, socketserver, sys, functools

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()
    def log_message(self, fmt, *args):
        pass

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8124
root = sys.argv[2] if len(sys.argv) > 2 else '.'
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', port), functools.partial(Handler, directory=root)) as httpd:
    print(f'serving on http://127.0.0.1:{port}')
    httpd.serve_forever()
