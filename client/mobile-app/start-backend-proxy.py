#!/usr/bin/env python3
"""
HTTP and WebSocket proxy to forward requests from network interface to localhost:8080
This makes kubectl port-forward accessible to mobile devices on the same network
Supports both HTTP requests and WebSocket upgrades
"""
import http.server
import socketserver
import urllib.request
import urllib.error
import sys
import socket
import select
import threading

LOCAL_IP = "192.168.178.179"  # Update this if your IP changes
LOCALHOST_PORT = 8080
NETWORK_PORT = 8080

class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        # Check if this is a WebSocket upgrade request
        if self.is_websocket_upgrade():
            self.handle_websocket_upgrade()
        else:
            self.proxy_request()
    
    def do_POST(self):
        self.proxy_request()
    
    def do_PUT(self):
        self.proxy_request()
    
    def do_DELETE(self):
        self.proxy_request()
    
    def do_OPTIONS(self):
        self.proxy_request()
    
    def is_websocket_upgrade(self):
        """Check if this is a WebSocket upgrade request"""
        connection = self.headers.get('Connection', '').lower()
        upgrade = self.headers.get('Upgrade', '').lower()
        return 'upgrade' in connection and upgrade == 'websocket'
    
    def handle_websocket_upgrade(self):
        """Handle WebSocket upgrade by forwarding at socket level"""
        try:
            # Create connection to localhost backend
            backend_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            backend_sock.connect(('localhost', LOCALHOST_PORT))
            
            # Forward the upgrade request
            request_line = f"{self.command} {self.path} HTTP/1.1\r\n"
            headers = [request_line]
            for header, value in self.headers.items():
                headers.append(f"{header}: {value}\r\n")
            headers.append("\r\n")
            request_data = ''.join(headers).encode()
            
            backend_sock.sendall(request_data)
            
            # Get the response from backend
            response = b''
            backend_sock.settimeout(5)
            try:
                while True:
                    chunk = backend_sock.recv(4096)
                    if not chunk:
                        break
                    response += chunk
                    # Check if we got the full HTTP response (ends with \r\n\r\n)
                    if b'\r\n\r\n' in response:
                        # Check if upgrade was successful (HTTP 101)
                        if response.startswith(b'HTTP/1.1 101'):
                            break
            except socket.timeout:
                pass
            
            # Send response to client
            self.wfile.write(response)
            self.wfile.flush()
            
            # If upgrade successful, forward WebSocket frames
            if response.startswith(b'HTTP/1.1 101'):
                # Switch to raw socket forwarding
                self.forward_websocket_frames(self.connection, backend_sock)
            else:
                backend_sock.close()
                
        except Exception as e:
            print(f"WebSocket upgrade error: {e}")
            self.send_error(502, f"WebSocket proxy error: {str(e)}")
    
    def forward_websocket_frames(self, client_sock, backend_sock):
        """Forward WebSocket frames bidirectionally"""
        def forward(src, dst):
            try:
                while True:
                    data = src.recv(4096)
                    if not data:
                        break
                    dst.sendall(data)
            except:
                pass
            finally:
                try:
                    src.close()
                    dst.close()
                except:
                    pass
        
        # Start bidirectional forwarding in separate threads
        t1 = threading.Thread(target=forward, args=(client_sock, backend_sock))
        t2 = threading.Thread(target=forward, args=(backend_sock, client_sock))
        t1.daemon = True
        t2.daemon = True
        t1.start()
        t2.start()
        t1.join()
        t2.join()
    
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
            
            # Make request - handle HTTP errors (4xx, 5xx) as valid responses
            try:
                response = urllib.request.urlopen(req, timeout=10)
                status_code = response.getcode()
                response_data = response.read()
                response_headers = dict(response.headers)
            except urllib.error.HTTPError as e:
                # HTTP errors (4xx, 5xx) are valid responses, not proxy errors
                status_code = e.code
                try:
                    response_data = e.read() if hasattr(e, 'read') else b''
                except:
                    response_data = b''
                response_headers = dict(e.headers) if hasattr(e, 'headers') else {}
            
            # Send response
            self.send_response(status_code)
            for header, value in response_headers.items():
                if header.lower() not in ['connection', 'transfer-encoding']:
                    self.send_header(header, value)
            self.end_headers()
            self.wfile.write(response_data)
            self.wfile.flush()
        except urllib.error.URLError as e:
            self.send_error(502, f"Proxy error: Cannot connect to backend - {str(e)}")
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
        # Bind only to the specific network IP, not all interfaces
        # This allows kubectl to use localhost:8080 while we use network IP:8080
        server = socketserver.TCPServer((LOCAL_IP, NETWORK_PORT), ProxyHandler, bind_and_activate=False)
        server.allow_reuse_address = True
        server.server_bind()
        server.server_activate()
        server.serve_forever()
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"Error: Port {NETWORK_PORT} on {LOCAL_IP} is already in use.")
            print("Stop the existing process or use a different port.")
            print(f"\nTo find the process: lsof -i @{LOCAL_IP}:{NETWORK_PORT}")
        else:
            print(f"Error: {e}")
        sys.exit(1)
