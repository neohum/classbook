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
try:
    import rhwp
except ImportError:
    rhwp = None

# Known subjects keywords and mapping to default textbook names
SUBJECT_MAP = {
    '국어': ['국어', '국어1-1가', '국어1-1나', '국어1-2가', '국어1-2나', '국어2-1', '국어2-2', '국어3-1', '국어4-1', '국어5-1', '국어6-1'],
    '국어활동': ['국어활동', '국어활동1-1', '국어활동1-2', '국어활동2-1'],
    '국활': ['국어활동', '국어활동1-1', '국어활동1-2', '국어활동2-1'],
    '수학': ['수학', '수학1-1', '수학1-2', '수학2-1', '수학2-2', '수학3-1', '수학4-1', '수학5-1', '수학6-1'],
    '수학익힘': ['수학익힘', '수학익힘1-1', '수학익힘1-2', '수학익힘2-1'],
    '수익': ['수학익힘', '수학익힘1-1', '수학익힘1-2', '수학익힘2-1'],
    '하루': ['하루', '하루1-1', '하루1-2'],
    '학교': ['학교', '학교1-1'],
    '사람들': ['사람들', '사람들1-1'],
    '탐험': ['탐험', '탐험1-1'],
    '봄': ['봄', '봄1-1', '학교1-1'],
    '여름': ['여름', '여름1-1', '사람들1-1'],
    '가을': ['가을', '가을1-1', '탐험1-1'],
    '겨울': ['겨울', '겨울1-1'],
    '바른생활': ['하루', '하루1-1', '하루1-2', '학교', '학교1-1', '바른생활'],
    '슬기로운생활': ['하루', '하루1-1', '하루1-2', '사람들', '사람들1-1', '슬기로운생활'],
    '즐거운생활': ['하루', '하루1-1', '하루1-2', '탐험', '탐험1-1', '즐거운생활'],
    '바생': ['하루', '하루1-1', '하루1-2', '학교', '학교1-1', '바른생활'],
    '슬생': ['하루', '하루1-1', '하루1-2', '사람들', '사람들1-1', '슬기로운생활'],
    '즐생': ['하루', '하루1-1', '하루1-2', '탐험', '탐험1-1', '즐거운생활'],
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
    '34~37쪽', '34-37', '24쪽', '(수 12~15, 익 10~11쪽)', 'p.12~15', '42'
    Returns: (pageStr, startPage, endPage)
    """
    if not text:
        return ("", None, None)

    # 0. Clean phone numbers, timestamps, dates, and lesson numbers
    clean_text = re.sub(r'\d{2,4}\s*-\s*\d{3,4}\s*-\s*\d{4}', '', text)  # phone numbers like 051-260-8621
    clean_text = re.sub(r'\(?\d{1,2}:\d{2}\s*[~∼\-]\s*\d{1,2}:\d{2}\)?', '', clean_text)  # time 09:00~09:40
    clean_text = re.sub(r'\d{1,2}월\s*\d{1,2}일\s*[~∼\-]\s*\d{1,2}월?\s*\d{1,2}일', '', clean_text)  # date range
    clean_text = re.sub(r'\(\s*\d+\s*/\s*\d+\s*(?:차시)?\s*\)', '', clean_text)  # (1/32) or (2/15) lesson counts
    clean_text = re.sub(r'\b\d+/\d+차시?\b', '', clean_text)

    # 1. Page with 쪽/p keyword explicitly: e.g. 12~15쪽, p.12~15
    m = re.search(r'(?:(?:쪽|p\.?|page)\s*(\d{1,3})\s*(?:~|∼|-|–)\s*(\d{1,3})|(\d{1,3})\s*(?:~|∼|-|–)\s*(\d{1,3})\s*쪽)', clean_text, re.IGNORECASE)
    if m:
        sp = int(m.group(1) or m.group(3))
        ep = int(m.group(2) or m.group(4))
        if 1 <= sp <= 350 and 1 <= ep <= 350 and sp <= ep:
            return (f"{sp}~{ep}쪽", sp, ep)

    # 2. Single page '12쪽' or 'p.12'
    m2 = re.search(r'(?:(\d{1,3})\s*쪽|p\.?\s*(\d{1,3}))', clean_text, re.IGNORECASE)
    if m2:
        val = int(m2.group(1) or m2.group(2))
        if 1 <= val <= 350:
            return (f"{val}쪽", val, val)

    # 3. Parentheses with numbers like (34-37) or (34~37)
    m3 = re.search(r'\(\s*(\d{1,3})\s*(?:~|∼|-|–)\s*(\d{1,3})\s*\)', clean_text)
    if m3:
        sp = int(m3.group(1))
        ep = int(m3.group(2))
        if 1 <= sp <= 350 and 1 <= ep <= 350 and sp <= ep:
            return (f"{sp}~{ep}쪽", sp, ep)

    # 4. Trailing or standalone '12~15'
    m4 = re.search(r'\b(\d{1,3})\s*(?:~|∼|-|–)\s*(\d{1,3})\b', clean_text)
    if m4:
        sp = int(m4.group(1))
        ep = int(m4.group(2))
        if 1 <= sp <= 350 and 1 <= ep <= 350 and sp <= ep:
            return (f"{sp}~{ep}쪽", sp, ep)

    # 5. Standalone single number: e.g. '15' or '42'
    m5 = re.match(r'^\s*(\d{1,3})\s*$', clean_text)
    if m5:
        val = int(m5.group(1))
        if 1 <= val <= 350:
            return (f"{val}쪽", val, val)

    return ("", None, None)

def identify_subject(text):
    """Detect subject from cell text"""
    sorted_subjects = sorted(SUBJECT_MAP.items(), key=lambda x: max(len(x[0]), max((len(a) for a in x[1]), default=0)), reverse=True)
    
    clean = re.sub(r'[\s\(\)\[\]0-9~.\-–쪽]', '', text)
    for sub, aliases in sorted_subjects:
        if sub in clean:
            return sub
        for al in aliases:
            if al in clean:
                return sub
                
    for sub in sorted(['국어활동', '수학익힘', '바른생활', '슬기로운생활', '즐거운생활', '국어', '수학', '바생', '슬생', '즐생', '하루', '학교', '사람들', '탐험', '봄', '여름', '가을', '겨울', '도덕', '사회', '과학', '체육', '음악', '미술', '영어', '안전', '창체'], key=len, reverse=True):
        if sub in text:
            return sub
    return ""

def match_book_id(subject, available_books, unit=""):
    """
    Given a parsed subject, available book IDs, and optional unit text,
    find the best matching book ID.
    In Korean elementary schools, integrated subjects (바른생활, 슬기로운생활, 즐거운생활)
    correspond to thematic textbooks named after the unit (e.g. '하루', '학교', '사람들', '탐험').
    """
    if not subject and not unit:
        return ""

    is_integrated = any(k in (subject or "") for k in ['바른생활', '슬기로운생활', '즐거운생활', '바생', '슬생', '즐생', '통합'])

    # 1. If unit is provided, check if unit contains a theme/book title
    if unit:
        clean_u = re.sub(r'^\d+\s*[\.\)]\s*', '', unit)
        clean_u = re.sub(r'\(\s*\d+\s*/\s*\d+\s*(?:차시)?\s*\)', '', clean_u).strip()
        
        # Check if clean_u or any keyword in unit matches available_books
        for b in available_books:
            bid = b.get('id', '')
            btitle = b.get('title', '')
            for target in [bid, btitle]:
                target_clean = re.sub(r'\d+-\d+.*$', '', target)
                if (target_clean and target_clean in unit) or (target and target in unit):
                    return bid

        if is_integrated:
            # Check for known integrated curriculum themes: '하루', '학교', '사람들', '탐험', '봄', '여름', '가을', '겨울', '세상'
            for theme in ['하루', '학교', '사람들', '탐험', '봄', '여름', '가을', '겨울', '세상']:
                if theme in unit:
                    for b in available_books:
                        bid = b.get('id', '')
                        if theme in bid:
                            return bid
                    return theme

    # 2. If subject is integrated, default to '하루' if mentioned or as primary fallback
    if is_integrated:
        if ('하루' in (unit or "")) or ('하루' in (subject or "")) or not unit:
            for b in available_books:
                bid = b.get('id', '')
                if '하루' in bid:
                    return bid
            return '하루'

    # 3. Exact match or starts with in available_books
    for b in available_books:
        bid = b.get('id', '')
        if subject == bid or bid.startswith(subject):
            return bid
    
    # 4. Check aliases in SUBJECT_MAP
    aliases = SUBJECT_MAP.get(subject, [])
    for al in aliases:
        for b in available_books:
            bid = b.get('id', '')
            if al == bid or bid.startswith(al):
                return bid

    # 5. Final fallback for integrated
    if is_integrated:
        return '하루'
                
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
    full_tables = []
    
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
        
        current_table_cells = {} # (row, col) -> list of strings
        current_cell = None
        max_row = -1
        max_col = -1

        def finalize_table():
            nonlocal current_table_cells, current_cell, max_row, max_col
            if current_table_cells and max_row >= 1 and max_col >= 2:
                matrix = [["" for _ in range(max_col + 1)] for _ in range(max_row + 1)]
                for (r, c), texts in current_table_cells.items():
                    if r <= max_row and c <= max_col:
                        matrix[r][c] = "\n".join(texts).strip()
                if any(any(cell for cell in row) for row in matrix):
                    full_tables.append(matrix)
            current_table_cells = {}
            current_cell = None
            max_row = -1
            max_col = -1
        
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

            # HWPTAG_TABLE = 75
            if tag_id == 75:
                finalize_table()

            # HWPTAG_CELL = 76
            elif tag_id == 76:
                if len(record_bytes) >= 4:
                    col_idx = int.from_bytes(record_bytes[0:2], 'little')
                    row_idx = int.from_bytes(record_bytes[2:4], 'little')
                    if row_idx <= 150 and col_idx <= 50:
                        current_cell = (row_idx, col_idx)
                        max_row = max(max_row, row_idx)
                        max_col = max(max_col, col_idx)

            # HWPTAG_PARA_TEXT = 67
            elif tag_id == 67:
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
                        if current_cell is not None:
                            current_table_cells.setdefault(current_cell, []).append(txt)
                except Exception:
                    pass

        finalize_table()

    ole.close()
    
    # 1. Try processing extracted 2D tables first
    if full_tables:
        table_result = process_tables(full_tables, doc_title)
        if table_result["success"] and sum(len(v) for v in table_result["schedule"].values()) > 0:
            return table_result

    # 2. Fallback to paragraph-based parser
    return process_paragraphs(extracted_paragraphs, doc_title)

def process_tables(tables, doc_title):
    """
    Search tables to locate the weekly schedule table.
    Supports both 1-row-per-period and 4-row-per-period (교과, 단원, 학습주제, 쪽수/준비물) layouts.
    In 4-row layouts, the 4th row has split cells where the FRONT cell is the textbook page.
    """
    best_schedule = {day: [] for day in DAY_NAMES}
    found = False
    available_books = get_available_books()

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
            r_idx = header_row_idx + 1

            while r_idx < len(table):
                row = table[r_idx]
                if not row:
                    r_idx += 1
                    continue

                # Check period number in row
                row_header_str = " ".join(row[:2])
                m_period = re.search(r'([1-8])\s*교시?', row_header_str)
                if m_period:
                    current_period = int(m_period.group(1))

                # Check if this table uses 4 rows per period
                # (Row 0: Subject, Row 1: Unit, Row 2: Topic, Row 3: Page/Materials)
                is_4row = False
                if r_idx + 3 < len(table):
                    h1 = " ".join(table[r_idx+1][:2])
                    h2 = " ".join(table[r_idx+2][:2])
                    h3 = " ".join(table[r_idx+3][:2])
                    if not re.search(r'([1-8])\s*교시', h1) and \
                       not re.search(r'([1-8])\s*교시', h2) and \
                       not re.search(r'([1-8])\s*교시', h3):
                        is_4row = True

                if is_4row:
                    r_subj = table[r_idx]
                    r_unit = table[r_idx+1]
                    r_topic = table[r_idx+2]
                    r_page = table[r_idx+3]

                    for d_idx, day in enumerate(DAY_NAMES):
                        subj_text = ""
                        unit_text = ""
                        topic_text = ""
                        page_text = ""

                        # If day_col_map exists, find corresponding col
                        matching_cols = [c for c, d in day_col_map.items() if d == day]
                        if matching_cols:
                            mc = matching_cols[0]
                            subj_text = r_subj[mc] if mc < len(r_subj) else ""
                            unit_text = r_unit[mc] if mc < len(r_unit) else ""
                            topic_text = r_topic[mc] if mc < len(r_topic) else ""
                            # Page row might have 2 cells per day (front cell is textbook page)
                            if len(r_page) >= 10:
                                page_text = r_page[d_idx * 2] if d_idx * 2 < len(r_page) else ""
                            elif mc < len(r_page):
                                page_text = r_page[mc]
                        else:
                            c = d_idx + 1
                            subj_text = r_subj[c] if c < len(r_subj) else ""
                            unit_text = r_unit[d_idx] if d_idx < len(r_unit) else (r_unit[c] if c < len(r_unit) else "")
                            topic_text = r_topic[d_idx] if d_idx < len(r_topic) else (r_topic[c] if c < len(r_topic) else "")
                            if len(r_page) >= 10:
                                page_text = r_page[d_idx * 2] if d_idx * 2 < len(r_page) else ""
                            else:
                                page_text = r_page[d_idx] if d_idx < len(r_page) else ""

                        subject = identify_subject(subj_text)
                        page_str, sp, ep = extract_page_info(page_text)
                        mbid = match_book_id(subject, available_books, unit=unit_text)

                        clean_topic = topic_text if topic_text else unit_text
                        if not clean_topic:
                            clean_topic = subject

                        if not subject and (topic_text or unit_text or page_str):
                            subject = "창의적체험활동" if ("활동" in clean_topic or "교육" in clean_topic) else "활동"

                        if subject or clean_topic or page_str:
                            item = {
                                "period": current_period,
                                "subject": subject if subject else "학습",
                                "matchedBookId": mbid,
                                "topic": clean_topic,
                                "pageStr": page_str,
                                "startPage": sp,
                                "endPage": ep,
                                "raw": f"{subject} {unit_text} {topic_text} {page_str}".strip()
                            }
                            best_schedule[day].append(item)

                    r_idx += 4
                    current_period += 1
                else:
                    # Single row per period
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
                    r_idx += 1

    return {
        "success": found,
        "title": doc_title,
        "schedule": best_schedule
    }

def parse_period_blocks(paragraphs, available_books):
    schedule = {day: [] for day in DAY_NAMES}
    
    # 1. Find period block boundaries (1~6교시)
    period_indices = []
    for idx, p in enumerate(paragraphs):
        p_clean = p.strip()
        m = re.search(r'(?:^|[^\d가-힣])([1-6])\s*교시', p_clean)
        if m:
            period_num = int(m.group(1))
            period_indices.append((idx, period_num))
            
    # Fallback: check for standalone 1~6 if no "교시" keyword found
    if not period_indices:
        for idx, p in enumerate(paragraphs):
            p_clean = p.strip()
            if re.match(r'^[\[\(]?([1-6])[\]\)]?$', p_clean):
                period_num = int(re.search(r'([1-6])', p_clean).group(1))
                period_indices.append((idx, period_num))

    if not period_indices:
        return None

    # End markers for the table
    end_markers = ['준비물', '가정통신', '가정 통신', '알림장', '알림사항', '행사안내', '안내사항', '시종시간', '통신란']
    table_end_idx = len(paragraphs)
    for idx in range(period_indices[-1][0] + 1, len(paragraphs)):
        p = paragraphs[idx].strip()
        if any(marker in p for marker in end_markers):
            table_end_idx = idx
            break

    # Process each period block
    for i, (start_idx, period_num) in enumerate(period_indices):
        end_idx = period_indices[i + 1][0] if i + 1 < len(period_indices) else table_end_idx
        block_paras = [paragraphs[k].strip() for k in range(start_idx + 1, end_idx) if paragraphs[k].strip()]
        
        # Filter out time strings like '(09:00~09:40)'
        clean_paras = []
        for p in block_paras:
            if re.match(r'^\(?\d{1,2}:\d{2}\s*[~∼\-]\s*\d{1,2}:\d{2}\)?$', p):
                continue
            if re.match(r'^\(?\d{1,2}:\d{2}\s*[~∼\-]?$', p):
                continue
            if re.match(r'^\d{1,2}:\d{2}\)?$', p):
                continue
            clean_paras.append(p)

        if not clean_paras:
            continue

        # Strategy A: Check if paragraphs are split into Subject row, Topic row(s), and Page row
        subjects = []
        subj_end = 0
        for p in clean_paras:
            subj = identify_subject(p)
            page_str, _, _ = extract_page_info(p)
            if subj and len(p) <= 12 and not page_str:
                subjects.append(subj)
                subj_end += 1
            else:
                break
                
        pages = []
        page_start = len(clean_paras)
        for k in range(len(clean_paras) - 1, -1, -1):
            p = clean_paras[k]
            page_str, sp, ep = extract_page_info(p)
            if page_str or (re.search(r'\d+\s*[~-]\s*\d+', p) and len(p) <= 15):
                pages.insert(0, (page_str, sp, ep, p))
                page_start = k
            else:
                break

        if len(subjects) >= 1:
            num_days = len(subjects)
            days_for_period = DAY_NAMES[:num_days]
            if num_days == 3 and period_num == 5:
                # 1~2학년 5교시는 보통 월, 화, 목
                days_for_period = ['월', '화', '목']

            topic_paras = clean_paras[subj_end:page_start]
            topics = [""] * num_days
            if len(topic_paras) == num_days:
                topics = topic_paras
            elif len(topic_paras) == num_days * 2:
                for d in range(num_days):
                    topics[d] = topic_paras[d*2] + " " + topic_paras[d*2+1]
            elif len(topic_paras) > 0:
                chunk_size = max(1, len(topic_paras) // num_days)
                for d in range(num_days):
                    start_t = d * chunk_size
                    end_t = (d + 1) * chunk_size if d < num_days - 1 else len(topic_paras)
                    topics[d] = " ".join(topic_paras[start_t:end_t])

            for d_idx, day in enumerate(days_for_period):
                subj = subjects[d_idx] if d_idx < len(subjects) else ""
                pg_info = pages[d_idx] if d_idx < len(pages) else ("", None, None, "")
                page_str, sp, ep = pg_info[0], pg_info[1], pg_info[2]
                topic = topics[d_idx] if d_idx < len(topics) else ""
                mbid = match_book_id(subj, available_books)
                
                schedule[day].append({
                    "period": period_num,
                    "subject": subj if subj else "학습",
                    "matchedBookId": mbid,
                    "topic": topic,
                    "pageStr": page_str,
                    "startPage": sp,
                    "endPage": ep,
                    "raw": f"{subj} {topic} {page_str}".strip()
                })
        else:
            # Strategy B: Each paragraph is 1 cell per day
            for d_idx, p in enumerate(clean_paras[:5]):
                day = DAY_NAMES[d_idx]
                subj = identify_subject(p)
                page_str, sp, ep = extract_page_info(p)
                mbid = match_book_id(subj, available_books)
                schedule[day].append({
                    "period": period_num,
                    "subject": subj if subj else "학습",
                    "matchedBookId": mbid,
                    "topic": p[:40],
                    "pageStr": page_str,
                    "startPage": sp,
                    "endPage": ep,
                    "raw": p
                })

    return schedule

def process_paragraphs(paragraphs, doc_title):
    """
    Fallback parser when HWP structure is flattened into paragraphs.
    Extracts days and periods by period-block grouping and heuristic matching.
    Includes auto-rebalancing for single-day crowding anomaly.
    """
    available_books = get_available_books()
    
    # 1. Primary parser: Period blocks (1~6교시)
    block_schedule = parse_period_blocks(paragraphs, available_books)
    if block_schedule and sum(len(v) for v in block_schedule.values()) > 0:
        return {
            "success": True,
            "title": doc_title,
            "schedule": block_schedule
        }

    # 2. Secondary fallback: check if paragraphs explicitly specify days
    schedule = {day: [] for day in DAY_NAMES}
    current_day = None
    current_period = 1

    for para in paragraphs:
        for day in DAY_NAMES:
            if re.search(rf'\[{day}\]|\({day}\)|{day}요일', para):
                current_day = day
                current_period = 1
                break

        if current_day:
            m_period = re.search(r'(?:^|[^\d가-힣])([1-6])\s*교시?', para)
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

    # 3. Anomaly Guard: Check if items got crowded into a single day (e.g. 52 items in '금')
    total_items = sum(len(v) for v in schedule.values())
    crowded_day = None
    for day, items in schedule.items():
        if len(items) >= 7 and len(items) >= total_items * 0.7:
            crowded_day = day
            break

    if crowded_day and total_items >= 5:
        crowded_items = schedule[crowded_day]
        new_schedule = {d: [] for d in DAY_NAMES}
        for idx, itm in enumerate(crowded_items):
            day_idx = idx % 5
            calc_period = min(6, (idx // 5) + 1)
            target_day = DAY_NAMES[day_idx]
            itm_copy = dict(itm)
            itm_copy["period"] = calc_period
            new_schedule[target_day].append(itm_copy)
        schedule = new_schedule

    return {
        "success": total_items > 0,
        "title": doc_title,
        "schedule": schedule
    }

def extract_rhwp_cell_text(cell):
    texts = []
    for b in getattr(cell, 'blocks', []):
        if hasattr(b, 'text') and b.text:
            texts.append(b.text.strip())
        elif hasattr(b, 'inlines'):
            for r in b.inlines:
                if hasattr(r, 'text') and r.text:
                    texts.append(r.text.strip())
        elif hasattr(b, 'paragraphs'):
            for p in b.paragraphs:
                if hasattr(p, 'text') and p.text:
                    texts.append(p.text.strip())
    return "\n".join([t for t in texts if t]).strip()

def convert_rhwp_table_to_matrix(tbl):
    rows = getattr(tbl, 'rows', 0)
    cols = getattr(tbl, 'cols', 0)
    if rows <= 0 or cols <= 0:
        return []
    matrix = [["" for _ in range(cols)] for _ in range(rows)]
    for cell in getattr(tbl, 'cells', []):
        txt = extract_rhwp_cell_text(cell)
        r = getattr(cell, 'row', 0)
        c = getattr(cell, 'col', 0)
        r_span = getattr(cell, 'row_span', 1) or 1
        c_span = getattr(cell, 'col_span', 1) or 1
        for dr in range(r_span):
            for dc in range(c_span):
                tr, tc = r + dr, c + dc
                if 0 <= tr < rows and 0 <= tc < cols:
                    if dr == 0 and dc == 0:
                        matrix[tr][tc] = txt
                    elif not matrix[tr][tc]:
                        matrix[tr][tc] = txt
    return matrix

def find_all_tables_from_rhwp_ir(ir):
    tables = []

    def walk_blocks(blocks):
        for b in blocks:
            if getattr(b, 'kind', '') == 'table' or hasattr(b, 'cells'):
                tables.append(b)
            if hasattr(b, 'cells'):
                for cell in b.cells:
                    if hasattr(cell, 'blocks'):
                        walk_blocks(cell.blocks)
            if hasattr(b, 'blocks'):
                walk_blocks(b.blocks)

    if hasattr(ir, 'body'):
        walk_blocks(ir.body)
    return tables

def parse_with_rhwp(filepath):
    if rhwp is None:
        return None
    try:
        doc = rhwp.parse(filepath)
    except Exception:
        return None

    doc_title = os.path.splitext(os.path.basename(filepath))[0]

    # 1. Try extracting tables from IR
    try:
        ir = doc.to_ir()
        tables = find_all_tables_from_rhwp_ir(ir)
        if tables:
            matrices = []
            for tbl in tables:
                m = convert_rhwp_table_to_matrix(tbl)
                if m and len(m) > 0 and len(m[0]) > 0:
                    matrices.append(m)
            if matrices:
                res = process_tables(matrices, doc_title)
                if res.get("success") and sum(len(v) for v in res.get("schedule", {}).values()) > 0:
                    return res
    except Exception:
        pass

    # 2. Try paragraph extraction
    try:
        paras = doc.paragraphs()
        if paras:
            res = process_paragraphs(paras, doc_title)
            if res.get("success") and sum(len(v) for v in res.get("schedule", {}).values()) > 0:
                return res
    except Exception:
        pass

    return None

def is_hwpml_file(filepath):
    """Check if the file is an HWPML XML document (even if named .hwp)"""
    try:
        with open(filepath, 'rb') as f:
            header = f.read(512)
            if b'<?xml' in header and (b'HWPML' in header or b'hwpml' in header or b'Hml' in header):
                return True
            if b'<HWPML' in header or b'<hwpml' in header:
                return True
    except Exception:
        pass
    return False

def parse_hwpml(filepath):
    """
    Parse HWPML (Hangul Markup Language XML) weekly plan documents.
    Supports multi-row period blocks (교과, 단원, 학습주제, 쪽수/준비물).
    In 4-row layouts, the 4th row has 2 split cells per day:
      - Front cell (index d*2): actual textbook page
      - Back cell (index d*2+1): materials / homework
    """
    try:
        tree = ET.parse(filepath)
    except Exception:
        with open(filepath, 'rb') as f:
            content = f.read()
        try:
            tree = ET.fromstring(content.decode('utf-8'))
        except Exception:
            tree = ET.fromstring(content.decode('cp949', errors='ignore'))
    
    root = tree if isinstance(tree, ET.Element) else tree.getroot()
    doc_title = os.path.splitext(os.path.basename(filepath))[0]
    available_books = get_available_books()

    # Search for doc title in tables or text (prefer semester/week title like "2학기 5주차 (2026.09.28.~2026.10.04.)")
    for tbl in root.findall('.//TABLE'):
        rows = tbl.findall('./ROW')
        if len(rows) == 1:
            for cell in rows[0].findall('./CELL'):
                txt = " ".join("".join(cell.itertext()).split())
                if re.search(r'\d+학기|\d+주차', txt):
                    doc_title = txt
                    break
                elif re.search(r'\d+월|\d+일|주간학습안내', txt) and doc_title == os.path.splitext(os.path.basename(filepath))[0]:
                    if len(txt) <= 60 and not re.search(r'\d{1,3}\.\d{1,3}\.\d{1,3}', txt):
                        doc_title = txt

    schedule = {d: [] for d in DAY_NAMES}
    found = False

    def get_cell_text(cell):
        texts = []
        for p in cell.findall('.//PARALIST'):
            t = ''.join(p.itertext()).strip()
            if t:
                texts.append(t)
        return ' '.join(' '.join(texts).split())

    # Find schedule tables (tables with day headers)
    for tbl in root.findall('.//TABLE'):
        rows = tbl.findall('./ROW')
        if len(rows) < 4:
            continue

        r0_cells = [get_cell_text(c) for c in rows[0].findall('./CELL')]
        day_indices = {}
        for c_idx, c_txt in enumerate(r0_cells):
            for d in DAY_NAMES:
                if d in c_txt and d not in day_indices.values():
                    day_indices[c_idx] = d

        if len(day_indices) < 3:
            continue

        found = True
        r = 1
        while r < len(rows):
            curr_row_cells = [get_cell_text(c) for c in rows[r].findall('./CELL')]
            if not curr_row_cells:
                r += 1
                continue

            first_cell = curr_row_cells[0]
            m_period = re.search(r'([1-8])\s*교시', first_cell)
            if m_period:
                period_num = int(m_period.group(1))

                subj_cells = curr_row_cells[1:]
                unit_cells = [get_cell_text(c) for c in rows[r+1].findall('./CELL')] if r+1 < len(rows) else []
                topic_cells = [get_cell_text(c) for c in rows[r+2].findall('./CELL')] if r+2 < len(rows) else []
                page_cells = [get_cell_text(c) for c in rows[r+3].findall('./CELL')] if r+3 < len(rows) else []

                is_4row = True
                for next_r in [unit_cells, topic_cells, page_cells]:
                    if next_r and re.search(r'([1-8])\s*교시', next_r[0]):
                        is_4row = False
                        break

                if is_4row and (unit_cells or topic_cells or page_cells):
                    for d_idx, day in enumerate(DAY_NAMES):
                        s = subj_cells[d_idx] if d_idx < len(subj_cells) else ""
                        u = unit_cells[d_idx] if d_idx < len(unit_cells) else ""
                        t = topic_cells[d_idx] if d_idx < len(topic_cells) else ""

                        # In 4-row layout: front cell is textbook page!
                        p_raw = ""
                        if len(page_cells) >= 10:
                            p_raw = page_cells[d_idx * 2]
                        elif len(page_cells) >= 5:
                            p_raw = page_cells[d_idx]

                        page_str, sp, ep = extract_page_info(p_raw)
                        mbid = match_book_id(s, available_books, unit=u)

                        clean_topic = t if t else u
                        if not clean_topic:
                            clean_topic = s

                        if not s and (t or u or page_str):
                            s = "창의적체험활동" if ("활동" in clean_topic or "교육" in clean_topic) else "활동"

                        if s or clean_topic or page_str:
                            schedule[day].append({
                                "period": period_num,
                                "subject": s if s else "학습",
                                "matchedBookId": mbid,
                                "topic": clean_topic,
                                "pageStr": page_str,
                                "startPage": sp,
                                "endPage": ep,
                                "raw": f"{s} {u} {t} {page_str}".strip()
                            })

                    r += 4
                else:
                    # Single row per period
                    for d_idx, day in enumerate(DAY_NAMES):
                        cell_txt = subj_cells[d_idx] if d_idx < len(subj_cells) else ""
                        if not cell_txt.strip():
                            continue
                        s = identify_subject(cell_txt)
                        page_str, sp, ep = extract_page_info(cell_txt)
                        mbid = match_book_id(s, available_books)
                        schedule[day].append({
                            "period": period_num,
                            "subject": s if s else "학습",
                            "matchedBookId": mbid,
                            "topic": cell_txt[:40],
                            "pageStr": page_str,
                            "startPage": sp,
                            "endPage": ep,
                            "raw": cell_txt.strip()
                        })
                    r += 1
            else:
                r += 1

    return {
        "success": found and sum(len(v) for v in schedule.values()) > 0,
        "title": doc_title,
        "schedule": schedule
    }

def parse_file(filepath):
    # 0. Try HWPML XML parser first (detects .hwp or .hml containing HWPML XML)
    if is_hwpml_file(filepath):
        try:
            hwpml_res = parse_hwpml(filepath)
            if hwpml_res is not None and hwpml_res.get("success"):
                return hwpml_res
        except Exception:
            pass

    # 1. Try rhwp first for robust parsing of HWP and HWPX
    try:
        rhwp_res = parse_with_rhwp(filepath)
        if rhwp_res is not None and rhwp_res.get("success"):
            return rhwp_res
    except Exception:
        pass

    # 2. Fallback to existing parsers
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
