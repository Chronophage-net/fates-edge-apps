#!/usr/bin/env python3
"""
Compatibility shim only -- `pyproject.toml` is the real source of
packaging truth for this project as of the v5.0.0 redesign (build
system, dependencies, and the `fates-edge` console-script entry point
all live there).

This file used to duplicate that metadata via a full setuptools
`setup()` call, which had already drifted out of sync with
pyproject.toml (different version numbers, different dependency lists)
before this redesign. It's kept around, deliberately empty, only because
some pip/setuptools versions still probe for `setup.py`'s presence (and
in a few cases execute it) when resolving an editable install, even with
a PEP 517 `pyproject.toml` present -- an earlier version of this stub
raised unconditionally on import, which broke exactly that path
(`pip install -e .`). Calling bare `setup()` with no arguments defers
entirely back to `pyproject.toml`, so this file is safe to keep, and
just as safe to delete:

    rm setup.py
"""

from setuptools import setup

setup()
