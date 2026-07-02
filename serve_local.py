import http.server
import mimetypes
import socketserver


def main():
    port = 8001
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("application/javascript", ".mjs")
    mimetypes.add_type("application/json", ".json")

    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("0.0.0.0", port), handler) as httpd:
        print(f"Serving on http://127.0.0.1:{port} (local)")
        httpd.serve_forever()


if __name__ == "__main__":
    main()

