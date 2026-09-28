import os
import sys
import json
import re
import zipfile
import zlib
import xml.etree.ElementTree as ET
try:
    import olefile
except ImportError:
    olefile = None

# Known subjects keywords and mapping to default textbook names
SUBJECT_MAP = {
    '국어': ['국어', '국어1-1가', '국어1-1나', '국어2-1', '국어3-1', '국어4-1', '국어5-1', '국어6-1'],
    '국어활동': ['국어활동', '국어활동1-1', '국어활동2-1'],
    '국활': ['국어활동', '국어활동1-1', '국어활동2-1'],
    '수학': ['수학', '수학1-1', '수학2-1', '수학3-1', '수학4-1', '수학5-1', '수학6-1'],
    '수학익힘': ['수학익힘', '수학익힘1-1', '수학익힘2-1'],
    '수익': ['수학익힘', '수학익힘1-1', '수학익힘2-1'],
    '학교': ['학교', '학교1-1'],
    '사람들': ['사람들', '사람들1-1'],
    '탐험': ['탐험', '탐험1-1'],
    '봄': ['봄', '봄1-1', '학교1-1'],
    '여름': ['여름', '여름1-1', '사람들1-1'],
    '가을': ['가을', '가을1-1', '탐험1-1'],
    '겨울': ['겨울', '겨울1-1'],
    '바른생활': ['바른생활', '학교1-1'],
    '슬기로운생활': ['슬기로운생활', '사람들1-1'],
    '즐거운생활': ['즐거운생활', '탐험1-1'],
    '바생': ['바른생활', '학교1-1'],
    '슬생': ['슬기로운생활', '사람들1-1'],
    '즐생': ['즐거운생활', '탐험1-1'],
    '도덕': ['도덕'],
    '사회': ['사회'],
    '과학': ['과학'],
    '실과': ['실과'],
    '체육': ['체육'],
    '음악': ['음악'],
    '미술': ['미술'],
    '영어': ['영어'],
    '안전': ['안전', '안전한생활'],
    '창체': ['창의적체험활동', '자율', '동아리', '봉사', '진로']
}

DAY_NAMES = ['월', '화', '수', '목', '금']

def extract_page_info(text):
    """
    Extract page ranges from text like:
    '34~37쪽', '34-37', '24쪽', '(수 12~15, 익 10~11쪽)', 'p.12~15'
    Returns: (pageStr, startPage, endPage)
    """
    # 1. '12~15' or '12-15' with optional 쪽/p
    m = re.search(r'(?:(?:쪽|p\.?|page)?\s*(\d{1,3})\s*(?:~|-|–)\s*(\d{1,3})\s*쪽?)', text, re.IGNORECASE)
    if m:
        sp = int(m.group(1))
        ep = int(m.group(2))
        return (f"{sp}~{ep}쪽", sp, ep)

    # 2. Single page '12쪽' or 'p.12'
    m2 = re.search(r'(?:(\d{1,3})\s*쪽|p\.?\s*(\d{1,3}))', text, re.IGNORECASE)
    if m2:
        val = int(m2.group(1) or m2.group(2))
        return (f"{val}쪽", val, val)

    # 3. Parentheses with numbers like (34-37)
    m3 = re.search(r'\(\s*(\d{1,3})\s*(?:~|-|–)\s*(\d{1,3})\s*\)', text)
    if m3:
        sp = int(m3.group(1))
        ep = int(m3.group(2))
        return (f"{sp}~{ep}쪽", sp, ep)

    return ("", None, None)

def identify_subject(text):
    """Detect subject from cell text"""
    # Sort subjects by length descending to match '국어활동' before '국어', '수학익힘' before '수학'
    sorted_subjects = sorted(SUBJECT_MAP.items(), key=lambda x: max(len(x[0]), max((len(a) for a in x[1]), default=0)), reverse=True)
    
    clean = re.sub(r'[\s\(\)\[\]0-9~.\-–쪽]', '', text)
    for sub, aliases in sorted_subjects:
        if sub in clean:
            return sub
        for al in aliases:
            if al in clean:
                return sub
                
    for sub in sorted(['국어활동', '수학익힘', '바른생활', '슬기로운생활', '즐거운생활', '국어', '수학', '바생', '슬생', '즐생', '봄', '여름', '가을', '겨울', '도덕', '사회', '과학', '체육', '음악', '미술', '영어', '안전', '창체', '학교', '사람들', '탐험'], key=len, reverse=True):
        if sub in text:
            return sub
    return ""

def match_book_id(subject, available_books):
    """
    Given a parsed subject and a list of available book IDs,
    find the best matching book ID.
    """
    if not subject:
        return ""
    # Exact match or starts with
    for b in available_books:
        bid = b.get('id', '')
        if subject == bid or bid.startswith(subject):
            return bid
    
    # Check aliases
    aliases = SUBJECT_MAP.get(subject, [])
    for al in aliases:
        for b in available_books:
            bid = b.get('id', '')
            if al == bid or bid.startswith(al):
                return bid
                
    return ""

def get_available_books(cwd=None):
    if cwd is None:
        cwd = os.getcwd()
    images_dir = os.path.join(cwd, "book", "images")
    books = []
    if os.path.exists(images_dir):
        for name in os.listdir(images_dir):
            if os.path.isdir(os.path.join(images_dir, name)):
                books.append({"id": name, "title": name})
    return books

def parse_hwpx(filepath):
    """Parse HWPX XML content to extract weekly schedule table"""
    with zipfile.ZipFile(filepath, 'r') as zf:
        # Find section files
        section_names = [name for name in zf.namelist() if re.match(r'Contents/section\d+\.xml', name, re.IGNORECASE)]
        if not section_names:
            section_names = [name for name in zf.namelist() if 'section' in name.lower() and name.endswith('.xml')]
            
        full_tables = []
        doc_title = os.path.splitext(os.path.basename(filepath))[0]

        for sname in section_names:
            xml_data = zf.read(sname)
            root = ET.fromstring(xml_data)

            # Look for all table elements: hp:tbl
            for tbl in root.iter():
                if tbl.tag.endswith('tbl'):
                    table_matrix = []
                    for tr in tbl.iter():
                        if tr.tag.endswith('tr'):
                            row_cells = []
                            for tc in tr.iter():
                                if tc.tag.endswith('tc'):
                                    # Get all text inside this cell
                                    texts = []
                                    for t in tc.iter():
                                        if t.tag.endswith('t') and t.text:
                                            texts.append(t.text.strip())
                                    cell_text = "\n".join([t for t in texts if t])
                                    row_cells.append(cell_text)
                            if row_cells:
                                table_matrix.append(row_cells)
                    if table_matrix:
                        full_tables.append(table_matrix)

        return process_tables(full_tables, doc_title)

def parse_hwp(filepath):
    """Parse HWP 5.0 OLE streams to extract text and tables"""
    if olefile is None:
        raise RuntimeError("olefile library is required for .hwp parsing")

    doc_title = os.path.splitext(os.path.basename(filepath))[0]
    ole = olefile.OleFileIO(filepath)

    # Check header
    header_data = ole.openstream('FileHeader').read()
    flags = int.from_bytes(header_data[36:40], 'little')
    is_compressed = bool(flags & 1)

    # Find BodyText sections
    section_streams = [s for s in ole.listdir() if s[0] == 'BodyText' and s[1].startswith('Section')]
    
    extracted_paragraphs = []
    
    for s_entry in section_streams:
        stream_data = ole.openstream(s_entry).read()
        if is_compressed:
            try:
                stream_data = zlib.decompress(stream_data, -15)
            except Exception:
                try:
                    stream_data = zlib.decompress(stream_data)
                except Exception as e:
                    continue

        # Parse HWP records
        offset = 0
        total_len = len(stream_data)
        
        while offset + 4 <= total_len:
            header_dword = int.from_bytes(stream_data[offset:offset+4], 'little')
            tag_id = header_dword & 0x3FF
            record_len = (header_dword >> 20) & 0xFFF
            offset += 4
            
            if record_len == 0xFFF:
                if offset + 4 <= total_len:
                    record_len = int.from_bytes(stream_data[offset:offset+4], 'little')
                    offset += 4
                else:
                    break

            if offset + record_len > total_len:
                break

            record_bytes = stream_data[offset:offset+record_len]
            offset += record_len

            # HWPTAG_PARA_TEXT = 67
            if tag_id == 67:
                try:
                    # UTF-16LE text
                    # Filter control codes < 0x20 except \n, \r, \t
                    chars = []
                    for i in range(0, len(record_bytes) - 1, 2):
                        code = int.from_bytes(record_bytes[i:i+2], 'little')
                        if code >= 0x20 or code in (10, 13, 9):
                            chars.append(chr(code))
                        elif code == 0:
                            break
                        else:
                            chars.append(' ')
                    txt = "".join(chars).strip()
                    if txt:
                        extracted_paragraphs.append(txt)
                except Exception:
                    pass

    ole.close()
    
    return process_paragraphs(extracted_paragraphs, doc_title)

def process_tables(tables, doc_title):
    """
    Search tables to locate the weekly schedule table.
    Typically rows correspond to periods (1~6), columns correspond to days (월~금).
    """
    best_schedule = {day: [] for day in DAY_NAMES}
    found = False

    for table in tables:
        # Check if table contains days (월, 화, 수, 목, 금)
        header_row_idx = -1
        day_col_map = {} # col_index -> day_name

        for r_idx, row in enumerate(table):
            for c_idx, cell in enumerate(row):
                for day in DAY_NAMES:
                    if day in cell and day not in day_col_map.values():
                        # Verify this looks like a day header
                        if len(cell.strip()) <= 12: # e.g. "월(23일)", "월"
                            day_col_map[c_idx] = day
            if len(day_col_map) >= 3: # Found at least 3 days in one row
                header_row_idx = r_idx
                break

        if header_row_idx >= 0 and len(day_col_map) >= 3:
            found = True
            current_period = 1
            for r_idx in range(header_row_idx + 1, len(table)):
                row = table[r_idx]
                if not row:
                    continue

                # Check period number in row
                row_header_str = " ".join(row[:2])
                m_period = re.search(r'([1-6])\s*교시?', row_header_str)
                if m_period:
                    current_period = int(m_period.group(1))

                for c_idx, cell_text in enumerate(row):
                    day = day_col_map.get(c_idx)
                    if not day or not cell_text.strip():
                        continue

                    subject = identify_subject(cell_text)
                    page_str, sp, ep = extract_page_info(cell_text)
                    
                    # Clean lines for topic
                    lines = [ln.strip() for ln in cell_text.split('\n') if ln.strip()]
                    topic = ""
                    for ln in lines:
                        # strip subject and page from line
                        cleaned_line = ln
                        if subject:
                            cleaned_line = re.sub(rf'^{re.escape(subject)}[:\s]*', '', cleaned_line)
                        if page_str:
                            cleaned_line = cleaned_line.replace(page_str, '').replace(f"({page_str})", '')
                        cleaned_line = re.sub(r'[\(\[\{]\s*\d+.*?\d*\s*쪽?\s*[\)\]\}]', '', cleaned_line)
                        cleaned_line = re.sub(r'\s*\d+\s*[~-]\s*\d+\s*쪽?', '', cleaned_line)
                        cleaned_line = re.sub(r'[\(\[\{]\s*[\)\]\}]', '', cleaned_line).strip()
                        if cleaned_line and cleaned_line != subject:
                            topic = cleaned_line
                            break
                    if not topic and lines:
                        topic = lines[-1] if len(lines) > 1 else lines[0]

                    if subject or page_str or topic:
                        available_books = get_available_books()
                        mbid = match_book_id(subject, available_books)
                        item = {
                            "period": current_period,
                            "subject": subject if subject else "학습",
                            "matchedBookId": mbid,
                            "topic": topic,
                            "pageStr": page_str,
                            "startPage": sp,
                            "endPage": ep,
                            "raw": cell_text.strip()
                        }
                        best_schedule[day].append(item)
                        
                current_period += 1

    return {
        "success": found,
        "title": doc_title,
        "schedule": best_schedule
    }

def process_paragraphs(paragraphs, doc_title):
    """
    Fallback parser when HWP structure is flattened into paragraphs.
    Extracts days and periods by heuristic regex matching.
    """
    schedule = {day: [] for day in DAY_NAMES}
    current_day = None
    current_period = 1
    available_books = get_available_books()

    # First attempt: check if table cell markers exist or paragraphs list days
    for para in paragraphs:
        for day in DAY_NAMES:
            if re.search(rf'^{day}\b|\[{day}\]|\({day}\)|{day}요일', para):
                current_day = day
                current_period = 1
                break

        if current_day:
            m_period = re.search(r'([1-6])\s*교시?', para)
            if m_period:
                current_period = int(m_period.group(1))

            subject = identify_subject(para)
            page_str, sp, ep = extract_page_info(para)
            if subject or page_str:
                mbid = match_book_id(subject, available_books)
                schedule[current_day].append({
                    "period": current_period,
                    "subject": subject if subject else "학습",
                    "matchedBookId": mbid,
                    "topic": para[:40],
                    "pageStr": page_str,
                    "startPage": sp,
                    "endPage": ep,
                    "raw": para
                })
                current_period += 1

    # If day-based didn't catch, try matching period blocks
    total_items = sum(len(v) for v in schedule.values())
    return {
        "success": total_items > 0,
        "title": doc_title,
        "schedule": schedule
    }

def parse_file(filepath):
    ext = os.path.splitext(filepath)[1].lower()
    if ext == '.hwpx':
        return parse_hwpx(filepath)
    elif ext == '.hwp':
        return parse_hwp(filepath)
    else:
        raise ValueError(f"Unsupported file format: {ext}")

if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    file_path = sys.argv[1]
    try:
        res = parse_file(file_path)
        print(json.dumps(res, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)
