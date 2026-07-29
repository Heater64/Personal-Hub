#!/usr/bin/env python3
"""Fix broken redirect links in game HTML files with proper UTF-8 encoding."""
import os, glob

games_dir = os.path.join(os.path.dirname(__file__), 'public', 'games')
for fpath in glob.glob(os.path.join(games_dir, '*.html')):
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    original = content
    content = content.replace('/pages/juegos.html', '/#/juegos')
    content = content.replace('/pages/calendario.html', '/#/calendario')
    if content != original:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Fixed: {os.path.basename(fpath)}')
    else:
        print(f'No changes: {os.path.basename(fpath)}')

print('Done - all files processed with correct UTF-8 encoding.')
