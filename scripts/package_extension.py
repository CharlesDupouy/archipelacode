#!/usr/bin/env python3
"""Build script to package the ArchipelaCode Chrome extension zip."""

import os
import sys
import zipfile
from pathlib import Path

def package_chrome_extension():
    repo_root = Path(__file__).resolve().parent.parent
    dist_dir = repo_root / "dist"
    output_path = repo_root / "archipelacode-chrome-extension.zip"

    if not dist_dir.exists():
        print("dist/ directory does not exist! Please run 'npm run compile' first.")
        sys.exit(1)

    if output_path.exists():
        output_path.unlink()

    print(f"Packaging Chrome Extension from {dist_dir} -> {output_path}...")
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for root, dirs, files in os.walk(dist_dir):
            for file in files:
                if file.endswith(".apworld") or file.endswith(".zip"):
                    continue
                full_path = Path(root) / file
                rel_path = full_path.relative_to(dist_dir)
                zip_file.write(full_path, arcname=str(rel_path))

    print(f"Successfully created {output_path} ({output_path.stat().st_size} bytes)")

if __name__ == "__main__":
    package_chrome_extension()
