#!/usr/bin/env python3
"""Import image files into one explicitly selected iOS Simulator Photos library."""
import argparse
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--device', help='Simulator UDID; required when multiple devices are booted')
parser.add_argument('--list', action='store_true', help='List booted devices without importing')
parser.add_argument('photos', nargs='*', type=Path)
args = parser.parse_args()
result = subprocess.run(['xcrun', 'simctl', 'list', 'devices', 'booted', '--json'], check=True, capture_output=True, text=True)
devices = [device for group in json.loads(result.stdout)['devices'].values() for device in group if device['state'] == 'Booted']
if args.list:
    for device in devices: print(f"{device['name']}  {device['udid']}")
    raise SystemExit(0)
if not args.photos: parser.error('Provide a local image path. Export a photo from Mac Photos first.')
if args.device:
    selected = next((device for device in devices if device['udid'] == args.device), None)
    if not selected: parser.error('--device must identify a currently booted simulator; use --list')
elif len(devices) == 1: selected = devices[0]
else: parser.error('Use --list, then --device UDID to select one simulator.')
for photo in args.photos:
    if not photo.is_file() or photo.suffix.lower() not in {'.jpg', '.jpeg', '.png', '.heic', '.heif'}:
        parser.error(f'Not a supported local image: {photo}')
subprocess.run(['xcrun', 'simctl', 'addmedia', selected['udid'], *[str(photo.resolve()) for photo in args.photos]], check=True)
print(f"Imported {len(args.photos)} image(s) into {selected['name']} ({selected['udid']}).")
print('Close and reopen the in-app photo picker, then select the imported image.')
