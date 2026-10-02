import sys
import os
import re
import json

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def detect_printed_page(doc, page_num):
    """Attempt to detect printed textbook page number from text layer."""
    try:
        page = doc[page_num]
        txt = page.get_text()
        lines = [l.strip() for l in txt.splitlines() if l.strip()]
        # Check last 3 lines and first 3 lines for standalone page numbers
        candidates = []
        if len(lines) >= 1:
            candidates.extend(lines[-3:])
            candidates.extend(lines[:2])
        for c in candidates:
            # Match 1-3 digits
            m = re.match(r'^(\d{1,3})$', c)
            if m:
                val = int(m.group(1))
                if 1 <= val <= 400:
                    return val
    except Exception:
        pass
    return None

def main():
    if len(sys.argv) < 3:
        print("Usage: python convert_pdf.py <pdf_path> <output_dir> [title]", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]
    title = sys.argv[3] if len(sys.argv) > 3 else os.path.splitext(os.path.basename(pdf_path))[0]

    try:
        import fitz
    except ImportError:
        print("ERROR: PyMuPDF (fitz) is not installed", file=sys.stderr)
        sys.exit(2)

    if not os.path.exists(pdf_path):
        print(f"ERROR: PDF file not found: {pdf_path}", file=sys.stderr)
        sys.exit(3)

    os.makedirs(output_dir, exist_ok=True)

    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        print(f"ERROR: Failed to open PDF: {e}", file=sys.stderr)
        sys.exit(4)

    total_pages = len(doc)
    detected_offset = None

    print(f"INIT:{total_pages}", flush=True)

    # 150 DPI gives great readability for high-res screens while keeping file size small (~300KB/page)
    matrix = fitz.Matrix(150 / 72, 150 / 72)

    for i in range(total_pages):
        page_num = i + 1
        page = doc[i]

        # Check for printed page number on pages 4 to 15
        if detected_offset is None and 4 <= page_num <= 15:
            printed = detect_printed_page(doc, i)
            if printed is not None and printed > 0:
                detected_offset = page_num - printed

        # Render page
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        out_file = os.path.join(output_dir, f"page_{page_num}.jpg")
        pix.save(out_file, "jpeg")

        pct = int((page_num / total_pages) * 100)
        curr_offset_str = str(detected_offset) if detected_offset is not None else ""
        print(f"PROGRESS:{page_num}:{total_pages}:{pct}:{curr_offset_str}", flush=True)

    final_offset = detected_offset if detected_offset is not None else 0

    # Write metadata.json
    meta = {
        "numPages": total_pages,
        "pageOffset": final_offset
    }
    meta_path = os.path.join(output_dir, "metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print(f"DONE:{total_pages}:{final_offset}", flush=True)

if __name__ == "__main__":
    main()
