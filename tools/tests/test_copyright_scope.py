import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('copyright_tool', Path(__file__).parents[1] / 'add-copyright-to-json.py')
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)

class ScopeTests(unittest.TestCase):
    def test_dependencies_and_manifests_are_untouched(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dep = root / 'node_modules' / 'commands.json'
            dep.parent.mkdir()
            dep.write_text('{"get":{"flags":[]}}')
            package = root / 'package.json'
            package.write_text('{"name":"example"}')
            owned = root / 'creature.json'
            owned.write_text('{"name":"Wolf"}')
            tool.license_tree(root)
            self.assertEqual(dep.read_text(), '{"get":{"flags":[]}}')
            self.assertEqual(package.read_text(), '{"name":"example"}')
            self.assertEqual(json.loads(owned.read_text())['_license'], tool.LICENSE)
            with self.assertRaises(ValueError):
                tool.license_tree(dep.parent)

if __name__ == '__main__':
    unittest.main()
