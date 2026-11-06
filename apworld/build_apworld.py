#!/usr/bin/env python3
"""Build script to package the archipelacode .apworld file for Archipelago."""

import os
import sys
import zipfile
from pathlib import Path

def build_apworld(output_dir: Path | None = None) -> Path:
    repo_root = Path(__file__).resolve().parent.parent
    src_dir = repo_root / "apworld" / "archipelacode"
    
    if output_dir is None:
        output_dir = repo_root / "dist"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    output_path = output_dir / "archipelacode.apworld"
    if output_path.exists():
        output_path.unlink()
        
    print(f"Building {output_path} from {src_dir}...")
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for root, dirs, files in os.walk(src_dir):
            # Ignore __pycache__ and hidden files
            dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__pycache__"]
            for file in files:
                if file.startswith(".") or file.endswith(".pyc"):
                    continue
                full_path = Path(root) / file
                rel_path = full_path.relative_to(src_dir.parent)
                zip_file.write(full_path, arcname=str(rel_path))
                
    print(f"Successfully created {output_path} ({output_path.stat().st_size} bytes)")
    return output_path

if __name__ == "__main__":
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    build_apworld(out)
