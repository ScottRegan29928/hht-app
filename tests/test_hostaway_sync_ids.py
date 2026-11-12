"""Pure importer identity tests; do not load credentials or call either API."""
import ast
from pathlib import Path
import unittest


def importer_helpers():
    source = Path(__file__).resolve().parents[1] / "scripts" / "hostaway_sync.py"
    tree = ast.parse(source.read_text())
    nodes = []
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == "hostaway_id":
            nodes.append(node)
        if isinstance(node, ast.Assign) and any(
            isinstance(t, ast.Name) and t.id in {"LISTING_OVERRIDES", "BED_TYPE_MAP"}
            for t in node.targets
        ):
            nodes.append(node)
    namespace = {}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(source), "exec"), namespace)
    return namespace


class HostawayImporterIdentityTests(unittest.TestCase):
    def setUp(self):
        self.helpers = importer_helpers()
        self.normalize = self.helpers["hostaway_id"]

    def test_numeric_text_and_exported_float_match(self):
        self.assertEqual(self.normalize(392457), "392457")
        self.assertEqual(self.normalize("392457"), "392457")
        self.assertEqual(self.normalize(392457.0), "392457")

    def test_large_strings_and_python_json_integers_remain_lossless(self):
        self.assertEqual(self.normalize("9007199254740993"), "9007199254740993")
        self.assertEqual(self.normalize(9007199254740993), "9007199254740993")
        self.assertNotEqual(self.normalize("9007199254740992"), self.normalize("9007199254740993"))

    def test_overrides_and_bed_taxonomy_use_the_normalized_key(self):
        self.assertEqual(self.helpers["LISTING_OVERRIDES"][self.normalize(392484)]["unit"], "2885")
        self.assertEqual(self.helpers["BED_TYPE_MAP"][self.normalize(2)], "King Bed")

    def test_invalid_identifiers_are_rejected(self):
        for value in (None, True, "", " ", "1e3", 0, -1, 1.5, 9007199254740992.0):
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.normalize(value)


if __name__ == "__main__":
    unittest.main()
