"""Generate the minimal liberal-education catalog; no lecturer/student data is retained."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import zipfile
import xml.etree.ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
ROOT = Path(__file__).resolve().parents[1]


def extract(path):
    records = set()
    with zipfile.ZipFile(path) as archive:
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = ["".join(node.itertext()) for node in ET.fromstring(archive.read("xl/sharedStrings.xml"))]
        for sheet in sorted(name for name in archive.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", name)):
            rows = ET.fromstring(archive.read(sheet)).findall(".//m:sheetData/m:row", NS)
            headers = None
            for row in rows:
                values = {}
                for cell in row:
                    col = re.sub(r"\d+", "", cell.attrib["r"])
                    value = cell.find("m:v", NS)
                    if cell.attrib.get("t") == "s":
                        text = strings[int(value.text)] if value is not None else ""
                    elif cell.attrib.get("t") == "inlineStr":
                        text = "".join(cell.find("m:is", NS).itertext())
                    else:
                        text = value.text if value is not None else ""
                    values[col] = text.strip()
                normalized = {re.sub(r"\s+", "", v): k for k, v in values.items()}
                if {"학수번호", "이수구분", "교과목명", "학점", "영역"} <= normalized.keys():
                    headers = normalized
                    continue
                if headers is None:
                    continue
                get = lambda name: values.get(headers[name], "")
                if get("이수구분") not in {"기초", "심화", "소양", "일교"}:
                    continue
                code = get("학수번호")
                if not re.fullmatch(r"[A-Z]+\d+", code):
                    raise ValueError(f"Invalid course code: {code}")
                credits = float(get("학점"))
                if not credits.is_integer() or credits <= 0:
                    raise ValueError(f"Unsupported credits: {code}")
                records.add((code, get("교과목명"), get("이수구분"), int(credits), get("영역")))
    if not records:
        raise ValueError("No liberal-education rows found; check workbook headers")
    return [dict(zip(["code", "name", "kind", "credits", "area"], row)) for row in sorted(records)]


def zip_entries(path):
    """Infer semester only from explicit workbook filenames; never extract archive paths."""
    entries = []
    with zipfile.ZipFile(path) as archive:
        if len(archive.infolist()) > 1000 or sum(info.file_size for info in archive.infolist()) > 100_000_000:
            raise ValueError("Archive is too large")
        for info in archive.infolist():
            if info.is_dir():
                continue
            name = info.filename
            if not info.flag_bits & 2048:
                try:
                    name = name.encode("cp437").decode("cp949")
                except UnicodeError:
                    pass
            if not name.lower().endswith(".xlsx"):
                continue
            filename = name.replace("\\", "/").rsplit("/", 1)[-1]
            matches = re.findall(r"(\d{4})년\s*(1|2|여름|겨울)학기", filename)
            if len(matches) != 1:
                raise ValueError(f"Semester is not unambiguous in filename: {filename}")
            year, semester = matches[0]
            data = archive.read(info)
            entries.append({"term": f"{year}-{semester}", "source": filename,
                            "sha256": hashlib.sha256(data).hexdigest(), "courses": extract(io.BytesIO(data))})
    if not entries:
        raise ValueError("No semester-named XLSX files found in archive")
    if len({entry["term"] for entry in entries}) != len(entries):
        raise ValueError("Multiple workbooks specify the same semester; resolve duplicates before importing")
    return entries


def merge_entries(data, entries, replace=False):
    terms = {entry["term"] for entry in entries}
    collisions = sorted({entry["term"] for entry in data} & terms)
    if collisions and not replace:
        raise ValueError(f"Semesters already registered: {', '.join(collisions)}; review and pass --replace")
    return sorted([item for item in data if item["term"] not in terms] + entries, key=lambda item: item["term"])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("file", type=Path)
    parser.add_argument("--term", help="Required for XLSX, e.g. 2026-2; ZIP uses each workbook filename")
    parser.add_argument("--replace", action="store_true", help="Explicitly replace the registered semester")
    parser.add_argument("--dry-run", action="store_true", help="Validate and print the summary without writing")
    parser.add_argument("--output", type=Path, default=ROOT / "src/data/timetables.json")
    args = parser.parse_args()
    try:
        if args.file.suffix.lower() == ".zip":
            if args.term:
                parser.error("ZIP imports infer semesters from filenames; do not pass --term")
            entries = zip_entries(args.file)
        elif args.file.suffix.lower() == ".xlsx":
            if not args.term or not re.fullmatch(r"\d{4}-(1|2|여름|겨울)", args.term):
                parser.error("XLSX requires a valid --term")
            entries = [{"term": args.term, "source": args.file.name,
                        "sha256": hashlib.sha256(args.file.read_bytes()).hexdigest(), "courses": extract(args.file)}]
        else:
            parser.error("Only .xlsx or .zip files are supported")
        output = args.output
        data = json.loads(output.read_text(encoding="utf-8")) if output.exists() else []
        merged = merge_entries(data, entries, args.replace)
        for entry in sorted(entries, key=lambda item: item["term"]):
            print(f"{entry['term']}: {len(entry['courses'])} distinct liberal-education records ({entry['source']})")
        if not args.dry_run:
            # All workbooks and collisions are validated before the single output write.
            output.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{'Validated' if args.dry_run else 'Registered'} {len(entries)} semesters; total {len(merged)} -> {output}")
    except (ValueError, zipfile.BadZipFile, OSError, KeyError, ET.ParseError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
