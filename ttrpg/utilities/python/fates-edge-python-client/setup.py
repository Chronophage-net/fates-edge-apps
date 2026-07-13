#!/usr/bin/env python3
"""
Fate's Edge Python Client
"""

from setuptools import setup, find_packages
import os
import re

def get_version():
    """Read version from the main module."""
    module_path = os.path.join(os.path.dirname(__file__), 'fates_edge_python_client.py')
    
    if os.path.exists(module_path):
        with open(module_path, 'r') as f:
            content = f.read()
            match = re.search(r'__version__\s*=\s*["\']([\d.]+)["\']', content)
            if match:
                return match.group(1)
    
    # Fallback
    return '1.0.0'

# Read README
def get_readme():
    if os.path.exists('README.md'):
        with open('README.md', 'r') as f:
            return f.read()
    return 'Fate\'s Edge Python Client'

setup(
    name='fates-edge-python-client',
    version=get_version(),
    author='Fate\'s Edge',
    description='Python client for Fate\'s Edge VTT',
    long_description=get_readme(),
    long_description_content_type='text/markdown',
    url='https://github.com/fates-edge/fates-edge',
    packages=find_packages(),
    py_modules=['fates_edge_python_client'],
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
    ],
    python_requires='>=3.8',
    install_requires=[
        'websocket-client>=1.5.0',
        'requests>=2.28.0',
        'python-socketio>=5.9.0',
    ],
    extras_require={
        'dev': [
            'pytest>=7.0.0',
            'pytest-cov>=4.0.0',
            'black>=22.0.0',
            'flake8>=6.0.0',
            'mypy>=1.0.0',
        ]
    },
    entry_points={
        'console_scripts': [
            'fates-edge=fates_edge_python_client:main',
        ],
    },
)