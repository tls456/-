"""Developer importer regression tests using only synthetic workbooks."""
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

SCRIPT = Path(__file__).with_name("import-timetable.py")
spec = importlib.util.spec_from_file_location("timetable_importer", SCRIPT)
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


def workbook(area="과학과기술"):
    stream = io.BytesIO()
    headers = ["학수번호", "교과목명", "이수구분", "학점", "영역"]
    row = ["TEST12345", "가상교양", "심화", "1", area]
    xml = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
    for number, values in enumerate([headers, row, row], 1):
        xml += f'<row r="{number}">'
        for column, value in zip("ABCDE", values):
            xml += f'<c r="{column}{number}" t="inlineStr"><is><t>{value}</t></is></c>'
        xml += '</row>'
    xml += '</sheetData></worksheet>'
    with zipfile.ZipFile(stream, "w") as archive:
        archive.writestr("xl/worksheets/sheet1.xml", xml)
    return stream.getvalue()


class ImporterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def archive(self, entries):
        path = self.root / "synthetic.zip"
        with zipfile.ZipFile(path, "w") as archive:
            for name, value in entries:
                archive.writestr(name, value)
        return path

    def test_deduplicates_sections_and_retains_only_liberal_fields(self):
        records = importer.extract(io.BytesIO(workbook()))
        self.assertEqual(len(records), 1)
        self.assertEqual(set(records[0]), {"code", "name", "kind", "credits", "area"})

    def test_all_semester_names_are_inferred_without_extraction(self):
        path = self.archive([(f"../nested/시간표 2024년 {term}학기.xlsx", workbook()) for term in ["1", "2", "여름", "겨울"]])
        entries = importer.zip_entries(path)
        self.assertEqual({entry["term"] for entry in entries}, {"2024-1", "2024-2", "2024-여름", "2024-겨울"})
        self.assertTrue(all("/" not in entry["source"] for entry in entries))
        self.assertEqual(list(self.root.iterdir()), [path])

    def test_does_not_guess_missing_semester(self):
        path = self.archive([("시간표.xlsx", workbook())])
        with self.assertRaisesRegex(ValueError, "not unambiguous"):
            importer.zip_entries(path)

    def test_duplicate_semester_in_zip_is_rejected(self):
        path = self.archive([("시간표 2025년 1학기.xlsx", workbook()), ("다른시간표 2025년 1학기.xlsx", workbook())])
        with self.assertRaisesRegex(ValueError, "same semester"):
            importer.zip_entries(path)

    def test_preserves_existing_semesters_and_requires_explicit_replace(self):
        original = [{"term": "2026-2", "source": "existing"}]
        self.assertEqual(importer.merge_entries(original, [{"term": "2025-1"}])[-1], original[0])
        with self.assertRaisesRegex(ValueError, "already registered"):
            importer.merge_entries(original, [{"term": "2026-2"}])
        self.assertEqual(importer.merge_entries(original, [{"term": "2026-2"}], True), [{"term": "2026-2"}])

    def test_dry_run_never_writes(self):
        path = self.archive([("시간표 2025년 1학기.xlsx", workbook())])
        output = self.root / "output.json"
        result = subprocess.run([sys.executable, str(SCRIPT), str(path), "--dry-run", "--output", str(output)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(output.exists())

    def test_invalid_member_does_not_partially_write(self):
        path = self.archive([("시간표 2025년 1학기.xlsx", workbook()), ("시간표.xlsx", workbook())])
        output = self.root / "output.json"
        output.write_text('[{"term":"2026-2"}]', encoding="utf-8")
        result = subprocess.run([sys.executable, str(SCRIPT), str(path), "--output", str(output)], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(json.loads(output.read_text(encoding="utf-8")), [{"term": "2026-2"}])

    def test_import_and_collision_preserve_existing_data(self):
        path = self.archive([("시간표 2025년 1학기.xlsx", workbook())])
        output = self.root / "output.json"
        command = [sys.executable, str(SCRIPT), str(path), "--output", str(output)]
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        before = output.read_bytes()
        self.assertEqual(json.loads(before)[0]["term"], "2025-1")
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(output.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
