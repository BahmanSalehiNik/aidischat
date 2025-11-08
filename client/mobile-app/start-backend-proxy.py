#!/usr/bin/env python3
"""
Simple HTTP proxy to forward requests from network interface to localhost:8080
This makes kubectl port-forward accessible to mobile devices on the same network
"""
import http.server
import socketserver
import urllib.request
import sys

LOCAL_IP = "192.168.178.179"  # Update this if your IP changes
LOCALHOST_PORT = 8080
NETWORK_PORT = 8080

class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.proxy_request()
    
    def do_POST(self):
        self.proxy_request()
    
    def do_PUT(self):
        self.proxy_request()
    
    def do_DELETE(self):
        self.proxy_request()
    
    def do_OPTIONS(self):
        self.proxy_request()
    
    def proxy_request(self):
        try:
            # Read request body if present
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length) if content_length > 0 else None
            
            # Create request to localhost
            url = f"http://localhost:{LOCALHOST_PORT}{self.path}"
            req = urllib.request.Request(url, data=body, method=self.command)
            
            # Copy headers
            for header, value in self.headers.items():
                if header.lower() not in ['host', 'connection']:
                    req.add_header(header, value)
            
            # Make request
            with urllib.request.urlopen(req, timeout=30) as response:
                # Send response
                self.send_response(response.getcode())
                for header, value in response.headers.items():
                    if header.lower() not in ['connection', 'transfer-encoding']:
                        self.send_header(header, value)
                self.end_headers()
                self.wfile.write(response.read())
        except Exception as e:
            self.send_error(502, f"Proxy error: {str(e)}")
    
    def log_message(self, format, *args):
        # Suppress default logging
        pass

if __name__ == "__main__":
    print(f"Starting proxy server on {LOCAL_IP}:{NETWORK_PORT}")
    print(f"Forwarding to http://localhost:{LOCALHOST_PORT}")
    print("\nMake sure kubectl port-forward is running:")
    print("  kubectl port-forward -n ingress-nginx service/ingress-nginx-controller 8080:80")
    print("\nPress Ctrl+C to stop\n")
    
    try:
        with socketserver.TCPServer((LOCAL_IP, NETWORK_PORT), ProxyHandler) as httpd:
            httpd.serve_forever()
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"Error: Port {NETWORK_PORT} is already in use.")
            print("Stop the existing process or use a different port.")
        else:
            print(f"Error: {e}")
        sys.exit(1)
