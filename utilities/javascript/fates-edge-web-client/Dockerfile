name: Build, Test & Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:
    inputs:
      force_build_docs:
        description: 'Force docs build'
        type: boolean
        default: true
      skip_docs:
        description: 'Skip docs build (overrides force)'
        type: boolean
        default: false
      build_pdfs:
        description: 'Build PDFs (slow, separate job)'
        type: boolean
        default: false
      enable_password:
        description: 'Enable password protection for toolkit'
        type: boolean
        default: true
      clear_password:
        description: 'Clear password protection'
        type: boolean
        default: true
      run_integration_tests:
        description: 'Run integration tests (may be flaky)'
        type: boolean
        default: false
      force_clean_deploy:
        description: 'Force clean deploy (clear caches)'
        type: boolean
        default: false
      build_docker:
        description: 'Build Docker image (disabled by default)'
        type: boolean
        default: false

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

env:
  ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION: true

jobs:
  # ============================================================
  # JOB 1: BUILD SITE WITH ALL DOCS
  # ============================================================
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    outputs:
      should_build_docs: ${{ steps.check-commit.outputs.should_build }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check commit message for docs trigger
        id: check-commit
        run: |
          SHOULD_BUILD="true"
          REASON="Default: building docs"
          SKIP_REASON=""

          COMMIT_MSG=$(git log -1 --pretty=%B)
          echo "📝 Commit message: $COMMIT_MSG"

          if echo "$COMMIT_MSG" | grep -qiE '\[skip docs\]|\[skip-docs\]|\[no docs\]|\[no-docs\]|skip docs|skip documentation'; then
            SHOULD_BUILD="false"
            SKIP_REASON="Commit message requested docs skip"
            echo "⏭️ $SKIP_REASON"
          elif [ "${{ github.event_name }}" == "workflow_dispatch" ] && [ "${{ github.event.inputs.skip_docs }}" == "true" ]; then
            SHOULD_BUILD="false"
            SKIP_REASON="Manual workflow trigger with skip_docs=true"
            echo "⏭️ $SKIP_REASON"
          elif [ "${{ github.event_name }}" == "workflow_dispatch" ] && [ "${{ github.event.inputs.force_build_docs }}" == "true" ]; then
            SHOULD_BUILD="true"
            REASON="Manual workflow trigger with force_build_docs=true"
            echo "🔨 $REASON"
          elif [ -f "BUILD_DOCS" ]; then
            SHOULD_BUILD="true"
            REASON="BUILD_DOCS file found"
            echo "🔨 $REASON"
            rm -f BUILD_DOCS
          elif git diff --name-only HEAD~1 2>/dev/null | grep -qE '\.tex$|\.md$|build_config\.toml$'; then
            SHOULD_BUILD="true"
            REASON="Document changes detected (TeX/Markdown/config files)"
            echo "🔨 $REASON"
          elif [ "${{ github.ref }}" == "refs/heads/main" ]; then
            SHOULD_BUILD="true"
            REASON="Default docs build on main branch"
            echo "🔨 $REASON"
          else
            SHOULD_BUILD="false"
            SKIP_REASON="No docs trigger conditions met"
            echo "⏭️ $SKIP_REASON"
          fi

          echo "should_build=$SHOULD_BUILD" >> $GITHUB_OUTPUT
          echo "reason=$REASON" >> $GITHUB_OUTPUT
          echo "skip_reason=$SKIP_REASON" >> $GITHUB_OUTPUT

      - name: Force clean deployment (before build)
        if: |
          steps.check-commit.outputs.should_build == 'true' &&
          github.event.inputs.force_clean_deploy == 'true'
        run: |
          echo "🧹 FORCE CLEAN: Removing previous artifacts..."
          rm -rf _site 2>/dev/null || true
          rm -rf build 2>/dev/null || true
          echo "✅ Clean slate ready"

      # ------------------------------------------------------------
      # STEP: Copy the entire website source (SPA) into _site
      # ------------------------------------------------------------
      - name: Copy website source to _site
        if: steps.check-commit.outputs.should_build == 'true'
        run: |
          echo "📁 Copying website source to _site (excluding source, tools, etc.)"
          mkdir -p _site
          rsync -av \
            --exclude='ttrpg' \
            --exclude='tools' \
            --exclude='node_modules' \
            --exclude='.git' \
            --exclude='.github' \
            --exclude='build' \
            --exclude='_site' \
            --exclude='*.log' \
            --exclude='*.aux' \
            --exclude='*.pdf' \
            ./ _site/
          echo "✅ Source copied (SPA + assets)"

      - name: Set up Node.js
        if: steps.check-commit.outputs.should_build == 'true'
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        if: steps.check-commit.outputs.should_build == 'true'
        run: |
          if [ -f package-lock.json ]; then
            npm ci --no-audit --no-fund
          elif [ -f package.json ]; then
            npm install --no-audit --no-fund
          fi

      - name: Set up Python
        if: steps.check-commit.outputs.should_build == 'true'
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install Python dependencies
        if: steps.check-commit.outputs.should_build == 'true'
        run: |
          python -m pip install --upgrade pip
          pip install beautifulsoup4 lxml tomli || pip install beautifulsoup4 lxml
          if [ -f requirements.txt ]; then pip install -r requirements.txt; fi

      - name: Cache TeX Live
        if: steps.check-commit.outputs.should_build == 'true'
        id: cache-texlive
        uses: actions/cache@v4
        with:
          path: |
            /usr/share/texlive
            /usr/local/texlive
            ~/.texlive
          key: ${{ runner.os }}-texlive-2024-full-v10
          restore-keys: |
            ${{ runner.os }}-texlive-2024-full-
            ${{ runner.os }}-texlive-2024-

      - name: Install TeX Live (Full)
        if: steps.check-commit.outputs.should_build == 'true'
        timeout-minutes: 30
        continue-on-error: true
        run: |
          echo "📦 Installing TeX Live..."
          sudo apt-get update
          sudo apt-get install -y \
            texlive-full \
            texlive-latex-extra \
            texlive-fonts-extra \
            texlive-xetex \
            latexmk \
            pandoc \
            || echo "⚠️ Some packages failed"
          sudo fc-cache -fv
          echo "✅ TeX Live installed"

      # ============================================================
      # BUILD STEP: Copies SRD/Essentials + builds LaTeX docs,
      # all into _site/data/docs/
      # ============================================================
      - name: Build all documents into _site/data/docs
        if: steps.check-commit.outputs.should_build == 'true'
        run: |
          echo "📚 Building all documents into _site/data/docs..."
          mkdir -p _site/data/docs

          # --- Step 1: Copy SRD into _site/data/docs ---
          if [ -f "ttrpg/srd/fates-edge-srd-main.html" ]; then
            cp ttrpg/srd/fates-edge-srd-main.html _site/data/docs/
            echo "✅ SRD copied to docs/fates-edge-srd-main.html"
          elif [ -f "ttrpg/srd/srd.html" ]; then
            cp ttrpg/srd/srd.html _site/data/docs/fates-edge-srd-main.html
            echo "✅ SRD copied to docs/fates-edge-srd-main.html (from srd.html)"
          else
            echo "⚠️ No SRD HTML file found"
          fi

          # --- Step 2: Copy Essentials into _site/data/docs ---
          if [ -f "ttrpg/essentials/essentials.html" ]; then
            cp ttrpg/essentials/essentials.html _site/data/docs/
            echo "✅ Essentials copied to docs/essentials.html"
          else
            echo "⚠️ No Essentials HTML file found"
          fi

          # --- Step 3: Build HTML from LaTeX (outputs to _site/data/docs) ---
          if [ -f "tools/latex_to_html.py" ] && [ -f "build_config.toml" ]; then
            echo "🔄 Building HTML documents from LaTeX..."

            cat > /tmp/build_docs.py << 'PYEOF'
          import tomllib
          import subprocess
          import sys
          import os
          from pathlib import Path

          try:
              with open("build_config.toml", "rb") as f:
                  config = tomllib.load(f)
          except FileNotFoundError:
              print("⚠️ build_config.toml not found, skipping LaTeX build")
              sys.exit(0)
          except Exception as e:
              print(f"⚠️ Error reading build_config.toml: {e}")
              sys.exit(0)

          docs = config.get("documents", [])

          # Core docs are handled separately – skip rebuilding them
          CORE_DOCS = {"essentials.html", "fates-edge-srd-main.html", "srd.html"}
          built = 0
          failed = 0
          skipped = 0

          for doc in docs:
              tex = doc.get("tex", "")
              if not tex:
                  continue

              html_name = doc.get("output", Path(tex).stem + ".html")
              if html_name in CORE_DOCS:
                  skipped += 1
                  print(f"⏭️ Skipping core doc: {html_name}")
                  continue

              tex_path = Path(tex)
              if not tex_path.exists():
                  found = None
                  for p in Path(".").rglob(tex_path.name):
                      if "node_modules" not in str(p) and ".git" not in str(p):
                          found = p
                          break
                  if found:
                      tex_path = found
                  else:
                      print(f"⚠️ {tex} not found, skipping")
                      failed += 1
                      continue

              title = doc.get("title", tex_path.stem.replace("_", " ").title())
              author = doc.get("author", "")
              output_dir = "_site/data/docs"
              output_file = html_name

              cmd = [
                  "python", "tools/latex_to_html.py",
                  str(tex_path),
                  "--output-dir", output_dir,
                  "-o", output_file,
                  "--title", title,
              ]
              if author:
                  cmd.extend(["--author", author])
              if doc.get("toc", True):
                  cmd.append("--toc")
              else:
                  cmd.append("--no-toc")
              if doc.get("mathjax", True):
                  cmd.append("--mathjax")
              else:
                  cmd.append("--no-mathjax")
              if doc.get("dark", False):
                  cmd.append("--dark")
              if doc.get("tikz", False):
                  cmd.append("--process-tikz")

              print(f"📄 Building: {tex_path.name} → {output_dir}/{output_file}")
              result = subprocess.run(cmd, capture_output=True, text=True)

              if result.returncode == 0:
                  built += 1
                  print(f"   ✅ Built: {output_file}")
              else:
                  failed += 1
                  print(f"   ❌ Failed: {tex_path.name}")
                  if result.stderr:
                      stderr_lines = result.stderr.strip().split('\n')[-5:]
                      for line in stderr_lines:
                          print(f"      {line}")

          print(f"\n📊 Build summary: {built} built, {failed} failed, {skipped} skipped")
          PYEOF

            python3 /tmp/build_docs.py
            rm -f /tmp/build_docs.py
          else
            echo "ℹ️ latex_to_html.py or build_config.toml not found, skipping LaTeX build"
          fi

          # --- Step 4: Create fallback index ONLY if SPA index is missing ---
          if [ ! -f "_site/index.html" ]; then
            cat > _site/index.html << 'HTMLEOF'
          <!DOCTYPE html>
          <html>
          <head>
            <title>Fate's Edge Toolkit</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              * { box-sizing: border-box; }
              body {
                font-family: system-ui, -apple-system, sans-serif;
                max-width: 1200px;
                margin: 2rem auto;
                padding: 0 2rem;
                background: #1a141a;
                color: #e6dce8;
              }
              a { color: #d4af37; text-decoration: none; }
              a:hover { text-decoration: underline; }
              .header { border-bottom: 2px solid #d4af37; padding-bottom: 1rem; margin-bottom: 2rem; }
              h1 { color: #d4af37; margin: 0; }
              .subtitle { color: #b0a0b0; margin: 0.5rem 0 0 0; }
              .card {
                background: #2a1f2a;
                padding: 1.5rem;
                margin: 1rem 0;
                border-radius: 12px;
                border: 1px solid #3a2f3a;
                max-width: 800px;
                transition: all 0.2s ease;
              }
              .card:hover {
                border-color: #d4af37;
                background: #2f2430;
                transform: translateY(-2px);
              }
              .card a {
                font-size: 1.3rem;
                font-weight: 600;
                display: block;
                margin-bottom: 0.5rem;
              }
              .card p {
                color: #b0a0b0;
                margin: 0;
              }
              .footer {
                color: #6a5a6a;
                font-size: 0.9rem;
                margin-top: 3rem;
                padding-top: 1rem;
                border-top: 1px solid #2a1f2a;
              }
              .badge {
                display: inline-block;
                background: #2a1f2a;
                padding: 0.2rem 0.8rem;
                border-radius: 20px;
                font-size: 0.8rem;
                color: #b0a0b0;
                border: 1px solid #3a2f3a;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>⚔️ Fate's Edge Toolkit</h1>
              <p class="subtitle">A TTRPG system of tactical combat and narrative depth.</p>
            </div>
            <div class="card">
              <a href="/data/docs/fates-edge-srd-main.html">📜 SRD</a>
              <p>System Reference Document - Core rules</p>
              <span class="badge">Core</span>
            </div>
            <div class="card">
              <a href="/data/docs/essentials.html">⚡ Essentials</a>
              <p>Essential rules for quick play</p>
              <span class="badge">Core</span>
            </div>
            <div id="docs-container">
              <p style="color: #6a5a6a;">Loading additional documents...</p>
            </div>
            <div class="footer">
              <p>Built with ❤️ for Fate's Edge TTRPG</p>
            </div>
            <script>
              fetch('/manifest-full.json')
                .then(r => r.json())
                .then(data => {
                  if (data.documents) {
                    const container = document.getElementById('docs-container');
                    const activeDocs = data.documents.filter(d => d.active && !d.core);
                    if (activeDocs.length > 0) {
                      container.innerHTML = '<h2 style="color: #d4af37;">📚 Additional Documents</h2>';
                      activeDocs.forEach(doc => {
                        const card = document.createElement('div');
                        card.className = 'card';
                        const link = document.createElement('a');
                        link.href = doc.path;
                        link.textContent = `📄 ${doc.title}`;
                        const p = document.createElement('p');
                        p.textContent = doc.categoryLabel || 'Document';
                        card.appendChild(link);
                        card.appendChild(p);
                        container.appendChild(card);
                      });
                    } else {
                      container.innerHTML = '<p style="color: #6a5a6a;">No additional documents available yet.</p>';
                    }
                  }
                })
                .catch(() => {
                  document.getElementById('docs-container').innerHTML =
                    '<p style="color: #6a5a6a;">More documents will appear here as they are built.</p>';
                });
            </script>
          </body>
          </html>
          HTMLEOF
            echo "✅ Fallback index created (no SPA index found)"
          else
            echo "✅ Keeping existing SPA index.html"
          fi

          # --- Step 5: Generate manifests (core + full) from _site/data/docs ---
          cat > /tmp/gen_manifests.py << 'PYEOF'
          import json
          from pathlib import Path

          docs_dir = Path("_site/data/docs")
          core_docs = []
          extra_docs = []

          # SRD (core)
          srd_path = docs_dir / "fates-edge-srd-main.html"
          if srd_path.exists():
              core_docs.append({
                  "id": "srd",
                  "title": "Fate's Edge SRD",
                  "file": "fates-edge-srd-main.html",
                  "path": "/data/docs/fates-edge-srd-main.html",
                  "category": "srd",
                  "categoryLabel": "System Reference Document",
                  "core": True,
                  "active": True
              })

          # Essentials (core)
          ess_path = docs_dir / "essentials.html"
          if ess_path.exists():
              core_docs.append({
                  "id": "essentials",
                  "title": "Fate's Edge Essentials",
                  "file": "essentials.html",
                  "path": "/data/docs/essentials.html",
                  "category": "essentials",
                  "categoryLabel": "Essentials",
                  "core": True,
                  "active": True
              })

          # Additional docs – any other .html file in _site/data/docs
          if docs_dir.exists():
              for html_file in sorted(docs_dir.glob("*.html")):
                  if html_file.name not in ["fates-edge-srd-main.html", "essentials.html", "index.html"]:
                      extra_docs.append({
                          "id": html_file.stem,
                          "title": html_file.stem.replace("_", " ").title(),
                          "file": html_file.name,
                          "path": f"/data/docs/{html_file.name}",
                          "category": "other",
                          "categoryLabel": "Document",
                          "core": False,
                          "active": True   # exists, so it's available
                      })

          all_docs = core_docs + extra_docs

          # Core manifest (only core docs)
          with open("_site/manifest-core.json", "w") as f:
              json.dump({
                  "version": "1.0",
                  "documents": core_docs,
                  "total_count": len(core_docs),
                  "active_count": len(core_docs)
              }, f, indent=2)
          print(f"✅ Core manifest: {len(core_docs)} documents")

          # Full manifest (all docs)
          with open("_site/manifest-full.json", "w") as f:
              json.dump({
                  "version": "2.0",
                  "documents": all_docs,
                  "total_count": len(all_docs),
                  "active_count": len(all_docs),
                  "fullManifestUrl": "/manifest-full.json",
                  "docsStatusUrl": "/data/docs-status.json"
              }, f, indent=2)
          print(f"✅ Full manifest: {len(all_docs)} documents")

          # Status
          import time
          with open("_site/data/docs-status.json", "w") as f:
              json.dump({
                  "status": "available",
                  "active_count": len(all_docs),
                  "total_count": len(all_docs),
                  "timestamp": str(int(time.time()))
              }, f, indent=2)
          print("✅ docs-status.json created")
          PYEOF

          python3 /tmp/gen_manifests.py
          rm -f /tmp/gen_manifests.py

      - name: Generate build lock for password protection
        if: steps.check-commit.outputs.should_build == 'true'
        env:
          TOOLKIT_PASSWORD: ${{ secrets.TOOLKIT_PASSWORD }}
          INPUT_CLEAR_PASSWORD: ${{ github.event.inputs.clear_password }}
          INPUT_ENABLE_PASSWORD: ${{ github.event.inputs.enable_password }}
        run: |
          cat > /tmp/gen_lock.py << 'PYEOF'
          import json
          import hashlib
          import os
          import time

          clear_password = os.environ.get("INPUT_CLEAR_PASSWORD", "") == "true"
          enable_password = os.environ.get("INPUT_ENABLE_PASSWORD", "") == "true"
          password = os.environ.get("TOOLKIT_PASSWORD", "")

          is_dispatch = os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch"

          if not is_dispatch:
              enable_password = True
              clear_password = False

          if clear_password:
              print("🔓 Force clearing password protection...")
              lock_data = {"locked": False, "cleared": True}
              with open("_site/build-lock.json", "w") as f:
                  json.dump(lock_data, f, indent=2)
              print("🔓 Password protection cleared")
          elif enable_password and password:
              print("🔒 Build lock enabled with password")
              lock_data = {
                  "locked": True,
                  "password_set": True,
                  "timestamp": os.environ.get("GITHUB_SHA", "unknown"),
                  "version": "1.0"
              }
              with open("_site/build-lock.json", "w") as f:
                  json.dump(lock_data, f, indent=2)
              with open("_site/password_hash.txt", "w") as f:
                  f.write(hashlib.sha256(password.encode()).hexdigest())
              print("✅ Password protection enabled")
          else:
              print("🔓 Build lock disabled (no password secret or not enabled)")
              lock_data = {"locked": False}
              with open("_site/build-lock.json", "w") as f:
                  json.dump(lock_data, f, indent=2)
          PYEOF

          python3 /tmp/gen_lock.py
          rm -f /tmp/gen_lock.py

      - name: Verify site structure
        if: steps.check-commit.outputs.should_build == 'true'
        run: |
          echo "=== Site structure ==="
          echo "📁 _site/"
          ls -la _site/ || echo "  (empty or missing)"
          echo ""
          echo "📁 _site/data/docs/"
          ls -la _site/data/docs/ 2>/dev/null || echo "  (not found)"
          echo ""
          echo "Total files: $(find _site -type f 2>/dev/null | wc -l)"
          echo "HTML files: $(find _site -name '*.html' 2>/dev/null | wc -l)"
          echo ""
          echo "=== Tree view (first 50) ==="
          find _site -type f 2>/dev/null | sort | head -50

      - name: Upload Pages artifact
        if: steps.check-commit.outputs.should_build == 'true'
        uses: actions/upload-pages-artifact@v3
        with:
          path: _site

      - name: Deploy to GitHub Pages
        if: steps.check-commit.outputs.should_build == 'true'
        id: deployment
        uses: actions/deploy-pages@v4

      - name: Report skipped build
        if: steps.check-commit.outputs.should_build != 'true'
        run: |
          echo "⏭️ Docs build skipped: ${{ steps.check-commit.outputs.skip_reason }}"

  # ============================================================
  # JOB 2: BUILD PDFS (Optional)
  # ============================================================
  build-pdfs:
    needs: build-and-deploy
    runs-on: ubuntu-latest
    if: |
      always() &&
      !cancelled() &&
      github.event.inputs.build_pdfs == 'true'
    continue-on-error: true
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install TeX Live
        timeout-minutes: 30
        continue-on-error: true
        run: |
          echo "📦 Installing TeX Live for PDF generation..."
          sudo apt-get update
          sudo apt-get install -y \
            texlive-full \
            texlive-latex-extra \
            texlive-fonts-extra \
            texlive-xetex \
            latexmk \
            || echo "⚠️ Some packages failed"

      - name: Build PDFs
        run: |
          echo "📚 Building PDF documents..."
          mkdir -p build/pdf

          cat > /tmp/build_pdfs.py << 'PYEOF'
          import tomllib
          import subprocess
          import sys
          import json
          from pathlib import Path

          try:
              with open("build_config.toml", "rb") as f:
                  config = tomllib.load(f)
          except FileNotFoundError:
              print("⚠️ build_config.toml not found")
              sys.exit(0)

          docs = config.get("documents", [])
          built = 0
          failed = 0

          for doc in docs:
              tex = doc.get("tex", "")
              if not tex:
                  continue

              tex_path = Path(tex)
              if not tex_path.exists():
                  found = None
                  for p in Path(".").rglob(tex_path.name):
                      if "node_modules" not in str(p) and ".git" not in str(p):
                          found = p
                          break
                  if found:
                      tex_path = found
                  else:
                      print(f"⚠️ {tex} not found")
                      failed += 1
                      continue

              pdf_name = doc.get("output", tex_path.stem + ".pdf")
              print(f"📄 Building PDF: {tex_path} → {pdf_name}")

              result = subprocess.run(
                  ["pdflatex", "-interaction=nonstopmode",
                   "-output-directory", "build/pdf", str(tex_path)],
                  capture_output=True,
                  text=True,
                  cwd=str(tex_path.parent)
              )

              if result.returncode == 0:
                  built += 1
                  print(f"✅ Built {pdf_name}")
              else:
                  failed += 1
                  stderr_tail = result.stderr.strip().split('\n')[-3:] if result.stderr else []
                  for line in stderr_tail:
                      print(f"   {line}")
                  print(f"❌ Failed to build {tex}")

          print(f"\n📊 PDF build: {built} built, {failed} failed")

          with open("build/pdf-status.json", "w") as f:
              json.dump({
                  "status": "available" if built > 0 else "failed",
                  "count": built,
                  "failed": failed
              }, f)
          PYEOF

          python3 /tmp/build_pdfs.py
          rm -f /tmp/build_pdfs.py

      - name: Upload PDF artifact
        uses: actions/upload-artifact@v4
        with:
          name: pdf-docs
          path: build/pdf
          retention-days: 7
          if-no-files-found: warn

  # ============================================================
  # JOB 3: DOCKER BUILD (lean image with only SRD + Essentials)
  # ============================================================
  build-docker:
    needs: build-and-deploy
    runs-on: ubuntu-latest
    if: |
      always() &&
      !cancelled() &&
      github.event.inputs.build_docker == 'true'
    continue-on-error: true
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      # ------------------------------------------------------------
      # Prepare a lean _site for Docker (SPA + core docs only)
      # ------------------------------------------------------------
      - name: Prepare lean _site for Docker
        run: |
          echo "📁 Preparing lean _site for Docker (SPA + SRD + Essentials only)"
          mkdir -p _site
          # Copy SPA source (exclude source folders)
          rsync -av \
            --exclude='ttrpg' \
            --exclude='tools' \
            --exclude='node_modules' \
            --exclude='.git' \
            --exclude='.github' \
            --exclude='build' \
            --exclude='_site' \
            --exclude='*.log' \
            --exclude='*.aux' \
            --exclude='*.pdf' \
            ./ _site/
          # Create docs directory and copy core docs
          mkdir -p _site/data/docs
          if [ -f "ttrpg/srd/fates-edge-srd-main.html" ]; then
            cp ttrpg/srd/fates-edge-srd-main.html _site/data/docs/
          elif [ -f "ttrpg/srd/srd.html" ]; then
            cp ttrpg/srd/srd.html _site/data/docs/fates-edge-srd-main.html
          fi
          if [ -f "ttrpg/essentials/essentials.html" ]; then
            cp ttrpg/essentials/essentials.html _site/data/docs/
          fi
          # Generate a manifest that lists only the core docs
          cat > _site/manifest-core.json << 'EOF'
          {
            "version": "1.0",
            "documents": [
              {
                "id": "srd",
                "title": "Fate's Edge SRD",
                "file": "fates-edge-srd-main.html",
                "path": "/data/docs/fates-edge-srd-main.html",
                "category": "srd",
                "categoryLabel": "System Reference Document",
                "core": true,
                "active": true
              },
              {
                "id": "essentials",
                "title": "Fate's Edge Essentials",
                "file": "essentials.html",
                "path": "/data/docs/essentials.html",
                "category": "essentials",
                "categoryLabel": "Essentials",
                "core": true,
                "active": true
              }
            ],
            "total_count": 2,
            "active_count": 2
          }
          EOF
          # Use the core manifest as the full manifest (so the SPA sees only these)
          cp _site/manifest-core.json _site/manifest-full.json
          # Create docs-status.json
          echo '{"status":"available","active_count":2,"total_count":2,"timestamp":"'$(date +%s)'"}' > _site/data/docs-status.json
          # Optionally, create a minimal build-lock (disabled)
          echo '{"locked":false}' > _site/build-lock.json

          echo "✅ Lean _site ready for Docker"

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Docker Hub
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: |
            ${{ secrets.DOCKER_USERNAME }}/fates-edge-toolkit:latest
            ${{ secrets.DOCKER_USERNAME }}/fates-edge-toolkit:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          labels: |
            org.opencontainers.image.title=Fate's Edge Toolkit
            org.opencontainers.image.description=Fate's Edge Toolkit (SPA + SRD + Essentials only)
            org.opencontainers.image.version=${{ github.ref_name }}
            org.opencontainers.image.revision=${{ github.sha }}