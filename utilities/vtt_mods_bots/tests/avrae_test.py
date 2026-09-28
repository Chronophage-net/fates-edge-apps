"""Check alias syntax and bounded command logic with mocked Avrae builtins.
This does not replace installation in Avrae's Draconic runtime.
"""
import ast
from pathlib import Path
import unittest

class AliasTests(unittest.TestCase):
    def test_alias(self):
        text = (Path(__file__).parent.parent / 'avrae_module.txt').read_text()
        self.assertTrue(text.startswith('!alias fates-edge <drac2>'))
        code = text.split('<drac2>', 1)[1].split('</drac2>', 1)[0].replace('&ARGS&', 'arguments')
        tree = ast.parse('def run(arguments):\n' + '\n'.join('    ' + line for line in code.splitlines()))
        self.assertFalse(any(isinstance(node, (ast.Import, ast.ImportFrom)) for node in ast.walk(tree)))
        rolls = []
        namespace = {'vroll': lambda expression: rolls.append(expression) or expression}
        exec(compile(tree, 'avrae_module.txt', 'exec'), namespace)
        run = namespace['run']
        self.assertIn('local dice', run([]))
        self.assertIn('4d10', run(['roll', '4']))
        for args in [['connect'], ['roll', '0'], ['roll', '31'], ['roll', '9999999999'], ['roll', '1;foo']]:
            run(args)
        self.assertEqual(rolls, ['4d10'])

if __name__ == '__main__':
    unittest.main()
