"""Synthetic camera integration fixture. Never opens hardware or contacts the image provider."""
import argparse
import io
import json
import threading
import time
from http.server import ThreadingHTTPServer
from PIL import Image, ImageDraw
import avatar_server
from camera_bridge import CameraSessions

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--port', type=int, default=8879)
parser.add_argument('--mode', choices=['native', 'browser'], default='native')
args = parser.parse_args()
picture = Image.new('RGB', (960, 720), '#101e30')
draw = ImageDraw.Draw(picture)
draw.ellipse((300, 90, 660, 450), fill='#ffc36b')
draw.rounded_rectangle((200, 480, 760, 690), radius=50, fill='#65daca')
draw.text((30, 30), 'SYNTHETIC CAMERA TEST / NO HARDWARE', fill='white', font_size=28)
output = io.BytesIO(); picture.save(output, 'JPEG'); frame = output.getvalue()

def opened(url):
    if args.mode == 'browser':
        # Ephemeral capabilities go only to the parent test process's private pipe.
        print(json.dumps({'cameraURL': url}), flush=True)
    else:
        ident, writer = url.split('#')[1].split('.')
        def publish():
            while avatar_server.cameras.frame(ident, writer, frame): time.sleep(.25)
        threading.Thread(target=publish, daemon=True).start()

avatar_server.cameras = CameraSessions(avatar_server.clean_image, opened)
threading.Thread(target=avatar_server.cameras.sweep, daemon=True).start()
server = ThreadingHTTPServer(('127.0.0.1', args.port), avatar_server.Handler)
print(json.dumps({'port': server.server_port, 'fixture': args.mode}), flush=True)
server.serve_forever()
