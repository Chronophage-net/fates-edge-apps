#!/usr/bin/env python3
"""
Robust build script for Fate's Edge Toolkit
Handles pandoc properly with error checking
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path
import glob
import json

def check_pandoc():
    """Check if pandoc is installed"""
    try:
        subprocess.run(['pandoc', '--version'], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def pandoc_to_html(tex_file, output_dir):
    """Convert a .tex file to HTML using pandoc"""
    tex_path = Path(tex_file)
    if not tex_path.exists():
        print(f"❌ File not found: {tex_file}")
        return False
    
    output_file = Path(output_dir) / (tex_path.stem + ".html")
    
    # Try pandoc first
    if check_pandoc():
        try:
            cmd = [
                'pandoc',
                '-f', 'latex',
                '-t', 'html5',
                '--standalone',
                '--metadata', 'pagetitle=' + tex_path.stem.replace('_', ' ').title(),
                str(tex_path),
                '-o', str(output_file)
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"❌ Pandoc failed on {tex_path.name}")
                print(f"   stderr: {result.stderr[:200]}...")
                return False
            print(f"✅ {tex_path.name} → {output_file.name}")
            return True
        except Exception as e:
            print(f"❌ Error converting {tex_path.name}: {e}")
            return False
    else:
        print(f"❌ Pandoc not found. Cannot convert {tex_file}")
        return False

def build_documents():
    """Build all documents"""
    tex_dir = Path("tex")
    output_dir = Path("build/html")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Find all .tex files
    tex_files = list(tex_dir.glob("*.tex"))
    
    if not tex_files:
        print("⚠️ No .tex files found in tex/")
        return
    
    print(f"📄 Found {len(tex_files)} .tex files")
    
    # Check pandoc
    if not check_pandoc():
        print("❌ pandoc is not installed!")
        print("   Please install pandoc: https://pandoc.org/")
        print("   On Ubuntu: sudo apt-get install pandoc")
        print("   On macOS: brew install pandoc")
        sys.exit(1)
    
    # Convert each file
    success_count = 0
    for tex_file in tex_files:
        if pandoc_to_html(tex_file, output_dir):
            success_count += 1
    
    print(f"\n✅ {success_count}/{len(tex_files)} files converted successfully")
    
    # Generate manifest
    generate_manifest(output_dir)

def generate_manifest(output_dir):
    """Generate manifest.json for document library"""
    manifest = []
    html_files = glob.glob(str(output_dir / "*.html"))
    
    for f in sorted(html_files):
        base = os.path.basename(f)
        if base in ("title.html", "copyright.html"):
            continue
        
        # Determine category
        content = open(f, 'r', encoding='utf-8').read().lower()
        category = "other"
        if "core" in content or "mechanic" in content:
            category = "core"
        elif "adventure" in content or "quest" in content:
            category = "adventure"
        elif "travel" in content or "road" in content:
            category = "travel"
        elif "expansion" in content:
            category = "expansion"
        elif "resource" in content or "reference" in content:
            category = "resource"
        
        title = base.replace(".html", "").replace("_", " ").title()
        manifest.append({
            "file": base,
            "title": title,
            "category": category
        })
    
    manifest_path = output_dir / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    
    print(f"✅ manifest.json created with {len(manifest)} entries")

if __name__ == "__main__":
    build_documents()
