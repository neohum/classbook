import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import parse_weekly_plan as p

def run_tests():
    # 1. Subject identification
    assert p.identify_subject('약속') == '약속', f"Expected '약속', got {p.identify_subject('약속')}"
    assert p.identify_subject('즐생') == '즐생', f"Expected '즐생', got {p.identify_subject('즐생')}"
    assert p.identify_subject('하루') == '하루', f"Expected '하루', got {p.identify_subject('하루')}"

    # 2. Book matching with context containing '약속'
    mbid1 = p.match_book_id('즐생', [], raw_text='즐생 1. 약속을 지켜요', topic='약속을 지켜요')
    assert mbid1 == '약속', f"Expected '약속', got {mbid1}"

    mbid2 = p.match_book_id('즐거운생활', [{'id': '하루1-2.pdf', 'title': '하루 1-2'}, {'id': '약속1-2.pdf', 'title': '약속 1-2'}], unit='약속', topic='약속 노래')
    assert mbid2 == '약속1-2.pdf', f"Expected '약속1-2.pdf', got {mbid2}"

    # 3. Resolve integrated subject name
    resolved_sub = p.resolve_integrated_subject(
        subject='즐생',
        matched_book_id='하루', # Even if previously defaulted to '하루'
        raw_text='즐생 약속',
        topic='약속을 지켜요'
    )
    assert resolved_sub == '약속', f"Expected '약속', got {resolved_sub}"

    # 4. Merge period items
    merged = p.merge_period_items([
        {
            'period': 2,
            'subject': '즐생',
            'matchedBookId': '',
            'raw': '즐생 약속',
            'topic': '약속을 지켜요'
        }
    ])
    assert merged is not None
    assert merged['subject'] == '약속', f"Expected '약속', got {merged['subject']}"

    print("All yakksok parser tests passed successfully!")

if __name__ == '__main__':
    run_tests()
