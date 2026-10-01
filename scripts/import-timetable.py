"""Generate the minimal liberal-education catalog; no lecturer/student data is retained."""
import argparse
import hashlib
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("file", type=Path)
    parser.add_argument("--term", required=True, help="e.g. 2026-2")
    parser.add_argument("--replace", action="store_true", help="Explicitly replace the registered semester")
    args = parser.parse_args()
    if not re.fullmatch(r"\d{4}-(1|2|여름|겨울)", args.term):
        parser.error("Invalid term")
    output = ROOT / "src/data/timetables.json"
    data = json.loads(output.read_text()) if output.exists() else []
    if any(item["term"] == args.term for item in data) and not args.replace:
        parser.error("Semester already registered; review the file and pass --replace")
    entry = {"term": args.term, "source": args.file.name,
             "sha256": hashlib.sha256(args.file.read_bytes()).hexdigest(), "courses": extract(args.file)}
    data = sorted([item for item in data if item["term"] != args.term] + [entry], key=lambda item: item["term"])
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(f"Registered {args.term}: {len(entry['courses'])} distinct liberal-education records -> {output}")


if __name__ == "__main__":
    main()
