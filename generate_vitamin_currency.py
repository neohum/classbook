import os
import fitz  # PyMuPDF
from playwright.sync_api import sync_playwright

def get_guilloche_pattern(color):
    """지폐 특유의 기하학 위조방지 곡선 배경 패턴"""
    return f'''<svg viewBox="0 0 200 100" preserveAspectRatio="none" style="position:absolute; width:100%; height:100%; top:0; left:0; opacity:0.12; pointer-events:none;">
      <path d="M 0 20 Q 50 80, 100 20 T 200 20 M 0 35 Q 50 95, 100 35 T 200 35 M 0 50 Q 50 110, 100 50 T 200 50 M 0 65 Q 50 5, 100 65 T 200 65 M 0 80 Q 50 20, 100 80 T 200 80" 
            stroke="{color}" stroke-width="0.8" fill="none"/>
      <circle cx="100" cy="50" r="35" stroke="{color}" stroke-width="0.8" stroke-dasharray="2,2" fill="none"/>
      <circle cx="100" cy="50" r="28" stroke="{color}" stroke-width="0.6" fill="none"/>
    </svg>'''

def get_svg_lemon():
    return '''<svg viewBox="0 0 100 100" class="bill-illus">
      <defs>
        <radialGradient id="lemonGrad" cx="45%" cy="40%" r="55%">
          <stop offset="0%" stop-color="#fffde7"/>
          <stop offset="65%" stop-color="#fcc419"/>
          <stop offset="100%" stop-color="#f59f00"/>
        </radialGradient>
        <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#8ce99a"/>
          <stop offset="100%" stop-color="#2b8a3e"/>
        </linearGradient>
      </defs>
      <!-- Leaf -->
      <path d="M 52 24 C 50 10, 76 8, 75 20 C 66 20, 56 22, 52 24 Z" fill="url(#leafGrad)"/>
      <path d="M 52 24 Q 64 16 75 20" stroke="#237032" stroke-width="1.5" fill="none"/>
      <!-- Lemon Body with cute pointed ends -->
      <path d="M 18 52 C 12 44, 22 26, 48 26 C 76 26, 88 42, 84 56 C 80 72, 60 78, 38 76 C 18 74, 12 62, 18 52 Z" 
            fill="url(#lemonGrad)" stroke="#e67700" stroke-width="2"/>
      <!-- Cheeks -->
      <ellipse cx="36" cy="56" rx="4" ry="2.2" fill="#ff8787" opacity="0.65"/>
      <ellipse cx="64" cy="56" rx="4" ry="2.2" fill="#ff8787" opacity="0.65"/>
      <!-- Eyes with sparkle -->
      <ellipse cx="40" cy="48" rx="3" ry="4" fill="#212529"/>
      <ellipse cx="60" cy="48" rx="3" ry="4" fill="#212529"/>
      <circle cx="39" cy="46" r="1.3" fill="#ffffff"/>
      <circle cx="59" cy="46" r="1.3" fill="#ffffff"/>
      <!-- Happy Smile -->
      <path d="M 46 54 Q 50 60 54 54" stroke="#212529" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <!-- Sparkle Star -->
      <polygon points="76,30 78,35 84,36 79,38 77,44 75,39 70,37 75,36" fill="#f59f00"/>
      <!-- Vitamin C badge capsule -->
      <g transform="translate(18,62)">
        <rect width="22" height="12" rx="6" fill="#2f9e44" stroke="#ffffff" stroke-width="1"/>
        <text x="11" y="9" font-family="'Montserrat', sans-serif" font-weight="900" font-size="7.5" fill="#ffffff" text-anchor="middle">Vit C</text>
      </g>
    </svg>'''

def get_svg_orange():
    return '''<svg viewBox="0 0 100 100" class="bill-illus">
      <defs>
        <radialGradient id="orangeGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fff4e6"/>
          <stop offset="60%" stop-color="#ff922b"/>
          <stop offset="100%" stop-color="#e8590c"/>
        </radialGradient>
        <linearGradient id="capGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ff6b6b"/>
          <stop offset="50%" stop-color="#ff6b6b"/>
          <stop offset="50%" stop-color="#ffd43b"/>
          <stop offset="100%" stop-color="#ffd43b"/>
        </linearGradient>
      </defs>
      <!-- Orange Outer Peel -->
      <circle cx="48" cy="50" r="33" fill="#f76707" stroke="#c92a2a" stroke-width="2"/>
      <circle cx="48" cy="50" r="29" fill="#ffe8cc"/>
      <!-- Orange Segments -->
      <path d="M 48 50 L 48 24 A 26 26 0 0 1 68 33 Z" fill="#ff922b"/>
      <path d="M 48 50 L 68 33 A 26 26 0 0 1 74 50 Z" fill="#f76707"/>
      <path d="M 48 50 L 74 50 A 26 26 0 0 1 66 69 Z" fill="#ff922b"/>
      <path d="M 48 50 L 66 69 A 26 26 0 0 1 48 76 Z" fill="#f76707"/>
      <path d="M 48 50 L 48 76 A 26 26 0 0 1 30 69 Z" fill="#ff922b"/>
      <path d="M 48 50 L 30 69 A 26 26 0 0 1 22 50 Z" fill="#f76707"/>
      <path d="M 48 50 L 22 50 A 26 26 0 0 1 28 33 Z" fill="#ff922b"/>
      <path d="M 48 50 L 28 33 A 26 26 0 0 1 48 24 Z" fill="#f76707"/>
      <circle cx="48" cy="50" r="4.5" fill="#ffe8cc"/>
      <!-- Cute Eyes & Smile -->
      <circle cx="41" cy="48" r="2.5" fill="#212529"/>
      <circle cx="55" cy="48" r="2.5" fill="#212529"/>
      <path d="M 44 54 Q 48 58 52 54" stroke="#212529" stroke-width="2" stroke-linecap="round" fill="none"/>
      <!-- Vitamin Energy Capsule -->
      <g transform="translate(63, 56) rotate(32)">
        <rect x="0" y="0" width="25" height="12" rx="6" fill="url(#capGrad)" stroke="#c92a2a" stroke-width="1.2"/>
        <line x1="12.5" y1="0" x2="12.5" y2="12" stroke="#ffffff" stroke-width="1.2"/>
        <text x="6" y="9" font-family="'Montserrat', sans-serif" font-weight="900" font-size="6.5" fill="#ffffff">5</text>
      </g>
      <!-- Sparkle -->
      <polygon points="18,22 20,26 25,27 21,29 19,34 17,29 13,27 17,26" fill="#ffd43b"/>
    </svg>'''

def get_svg_berry():
    return '''<svg viewBox="0 0 100 100" class="bill-illus">
      <defs>
        <radialGradient id="shieldGrad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="60%" stop-color="#dbe4ff"/>
          <stop offset="100%" stop-color="#91a7ff"/>
        </radialGradient>
        <linearGradient id="crownGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fff3bf"/>
          <stop offset="50%" stop-color="#ffd43b"/>
          <stop offset="100%" stop-color="#f59f00"/>
        </linearGradient>
      </defs>
      <!-- Outer Royal Crest Shield -->
      <path d="M 50 14 Q 76 14 80 34 Q 82 66 50 86 Q 18 66 20 34 Q 24 14 50 14 Z" 
            fill="url(#shieldGrad)" stroke="#364fc7" stroke-width="2.5"/>
      <path d="M 50 19 Q 72 19 75 36 Q 77 62 50 80 Q 23 62 25 36 Q 28 19 50 19 Z" 
            fill="none" stroke="#fab005" stroke-width="1.3" stroke-dasharray="3,1.5"/>
      
      <!-- Royal Crown -->
      <path d="M 35 34 L 38 46 L 62 46 L 65 34 L 56 40 L 50 30 L 44 40 Z" 
            fill="url(#crownGrad)" stroke="#e67700" stroke-width="1.3"/>
      <circle cx="35" cy="33" r="1.8" fill="#e03131"/>
      <circle cx="50" cy="29" r="2" fill="#1971c2"/>
      <circle cx="65" cy="33" r="1.8" fill="#e03131"/>
      
      <!-- Big Golden Star Badge -->
      <polygon points="50,48 53,55 61,56 55,61 57,69 50,65 43,69 45,61 39,56 47,55" 
               fill="url(#crownGrad)" stroke="#d9480f" stroke-width="1.2"/>
      <text x="50" y="61.5" font-family="'Montserrat', sans-serif" font-weight="900" font-size="8.5" fill="#364fc7" text-anchor="middle">10</text>
      
      <!-- Golden Laurel Leaves -->
      <path d="M 26 56 Q 32 72 48 78" stroke="#fab005" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M 74 56 Q 68 72 52 78" stroke="#fab005" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    </svg>'''

def get_svg_stamp():
    return '''<svg viewBox="0 0 60 60" class="official-stamp">
      <circle cx="30" cy="30" r="26" fill="none" stroke="#c92a2a" stroke-width="2" stroke-dasharray="4,1.5"/>
      <circle cx="30" cy="30" r="22.5" fill="none" stroke="#c92a2a" stroke-width="1"/>
      <rect x="14" y="15" width="32" height="30" rx="3" fill="#ffe3e3" fill-opacity="0.4" stroke="#c92a2a" stroke-width="0.8"/>
      <text x="30" y="24" font-family="'Noto Sans KR', sans-serif" font-weight="900" font-size="7.5" fill="#c92a2a" text-anchor="middle" letter-spacing="1.2">비타민</text>
      <text x="30" y="34" font-family="'Noto Sans KR', sans-serif" font-weight="900" font-size="8" fill="#a61e4d" text-anchor="middle" letter-spacing="1.2">은행장</text>
      <text x="30" y="42" font-family="'Montserrat', sans-serif" font-weight="800" font-size="4.8" fill="#c92a2a" text-anchor="middle" letter-spacing="0.5">OFFICIAL</text>
    </svg>'''

def get_svg_wallet():
    return '''<svg viewBox="0 0 100 100" class="card-illus">
      <defs>
        <linearGradient id="walletGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#20c997"/>
          <stop offset="100%" stop-color="#099268"/>
        </linearGradient>
      </defs>
      <rect x="15" y="22" width="70" height="56" rx="10" fill="url(#walletGrad)" stroke="#087f5b" stroke-width="2.5"/>
      <path d="M 15 38 L 85 38" stroke="#087f5b" stroke-width="2"/>
      <path d="M 52 44 H 85 V 66 H 52 A 11 11 0 0 1 52 44 Z" fill="#12b886" stroke="#087f5b" stroke-width="2"/>
      <circle cx="62" cy="55" r="4" fill="#ffd43b" stroke="#f59f00" stroke-width="1.5"/>
      <!-- Star on front -->
      <polygon points="34,48 36,53 42,54 38,58 39,64 34,61 29,64 30,58 26,54 32,53" fill="#fff3bf"/>
    </svg>'''

def get_svg_guide():
    return '''<svg viewBox="0 0 100 100" class="card-illus">
      <circle cx="50" cy="50" r="38" fill="#e7f5ff" stroke="#1c7ed6" stroke-width="2.5"/>
      <!-- Exchange Arrows -->
      <path d="M 30 42 L 70 42" stroke="#1c7ed6" stroke-width="3.5" stroke-linecap="round"/>
      <polygon points="68,36 78,42 68,48" fill="#1c7ed6"/>
      <path d="M 70 58 L 30 58" stroke="#f76707" stroke-width="3.5" stroke-linecap="round"/>
      <polygon points="32,52 22,58 32,64" fill="#f76707"/>
      <!-- Center Coin -->
      <circle cx="50" cy="50" r="10" fill="#ffd43b" stroke="#f59f00" stroke-width="1.8"/>
      <text x="50" y="54" font-family="'Montserrat', sans-serif" font-weight="900" font-size="10" fill="#212529" text-anchor="middle">v</text>
    </svg>'''

def get_svg_bonus():
    return '''<svg viewBox="0 0 100 100" class="card-illus">
      <defs>
        <radialGradient id="giftGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fff3bf"/>
          <stop offset="100%" stop-color="#fcc419"/>
        </radialGradient>
      </defs>
      <!-- Present Box -->
      <rect x="22" y="38" width="56" height="44" rx="6" fill="#ff6b6b" stroke="#c92a2a" stroke-width="2"/>
      <rect x="18" y="28" width="64" height="14" rx="4" fill="#fa5252" stroke="#c92a2a" stroke-width="2"/>
      <rect x="44" y="28" width="12" height="54" fill="#ffd43b"/>
      <!-- Ribbons -->
      <path d="M 44 28 C 32 14, 20 26, 44 28 Z" fill="#ffd43b" stroke="#f59f00" stroke-width="1.5"/>
      <path d="M 56 28 C 68 14, 80 26, 56 28 Z" fill="#ffd43b" stroke="#f59f00" stroke-width="1.5"/>
      <!-- Sparkles -->
      <polygon points="80,18 82,23 87,24 83,27 84,32 80,29 76,32 77,27 73,24 78,23" fill="#fab005"/>
      <polygon points="18,68 20,72 25,73 21,75 22,79 18,77 14,79 15,75 11,73 16,72" fill="#fab005"/>
    </svg>'''

def generate_bill_1v(idx):
    sn = f"V1-26{idx:03d}"
    return f'''
    <div class="card bill bill-1v">
      <div class="crop-border">
        <div class="bill-inner">
          {get_guilloche_pattern("#2b8a3e")}
          <div class="bill-header">
            <span class="corner-val">1v</span>
            <span class="bank-title">VITAMIN CENTRAL BANK</span>
            <span class="corner-val">1v</span>
          </div>
          <div class="bill-body">
            <div class="illus-wrap">
              {get_svg_lemon()}
            </div>
            <div class="main-info">
              <div class="kor-val">일 비타민</div>
              <div class="center-val-wrap">
                <span class="num-val">1</span>
                <span class="unit-val">v</span>
              </div>
              <div class="eng-val">ONE VITAMIN</div>
            </div>
            <div class="stamp-wrap">
              {get_svg_stamp()}
            </div>
          </div>
          <div class="bill-footer">
            <span class="serial-no">{sn}</span>
            <span class="footer-msg">★ 가상 시장 공용 화폐 ★</span>
            <span class="security-text">1 VITAMIN</span>
          </div>
        </div>
      </div>
    </div>
    '''

def generate_bill_5v(idx):
    sn = f"V5-26{idx:03d}"
    return f'''
    <div class="card bill bill-5v">
      <div class="crop-border">
        <div class="bill-inner">
          {get_guilloche_pattern("#d9480f")}
          <div class="bill-header">
            <span class="corner-val">5v</span>
            <span class="bank-title">VITAMIN CENTRAL BANK</span>
            <span class="corner-val">5v</span>
          </div>
          <div class="bill-body">
            <div class="illus-wrap">
              {get_svg_orange()}
            </div>
            <div class="main-info">
              <div class="kor-val">오 비타민</div>
              <div class="center-val-wrap">
                <span class="num-val">5</span>
                <span class="unit-val">v</span>
              </div>
              <div class="eng-val">FIVE VITAMINS</div>
            </div>
            <div class="stamp-wrap">
              {get_svg_stamp()}
            </div>
          </div>
          <div class="bill-footer">
            <span class="serial-no">{sn}</span>
            <span class="footer-msg">★ 가상 시장 공용 화폐 ★</span>
            <span class="security-text">5 VITAMINS</span>
          </div>
        </div>
      </div>
    </div>
    '''

def generate_bill_10v(idx):
    sn = f"V10-26{idx:03d}"
    return f'''
    <div class="card bill bill-10v">
      <div class="crop-border">
        <div class="bill-inner">
          {get_guilloche_pattern("#364fc7")}
          <div class="bill-header">
            <span class="corner-val">10v</span>
            <span class="bank-title">VITAMIN CENTRAL BANK</span>
            <span class="corner-val">10v</span>
          </div>
          <div class="bill-body">
            <div class="illus-wrap">
              {get_svg_berry()}
            </div>
            <div class="main-info">
              <div class="kor-val">십 비타민</div>
              <div class="center-val-wrap">
                <span class="num-val">10</span>
                <span class="unit-val">v</span>
              </div>
              <div class="eng-val">TEN VITAMINS</div>
            </div>
            <div class="stamp-wrap">
              {get_svg_stamp()}
            </div>
          </div>
          <div class="bill-footer">
            <span class="serial-no">{sn}</span>
            <span class="footer-msg">★ 가상 시장 공식 화폐 ★</span>
            <span class="security-text">10 VITAMINS</span>
          </div>
        </div>
      </div>
    </div>
    '''

def generate_wallet_card():
    return f'''
    <div class="card special-card card-wallet">
      <div class="crop-border">
        <div class="bill-inner">
          <div class="bill-header">
            <span class="badge-tag">WALLET</span>
            <span class="bank-title">비타민 마켓 전용 지갑표</span>
            <span class="badge-tag">PASS</span>
          </div>
          <div class="special-body">
            <div class="illus-wrap-sm">
              {get_svg_wallet()}
            </div>
            <div class="wallet-form">
              <div class="form-row">
                <span class="form-label">이름:</span>
                <span class="form-line"></span>
              </div>
              <div class="form-row">
                <span class="form-label">모둠/학급:</span>
                <span class="form-line"></span>
              </div>
              <div class="wallet-tip">소중한 내 비타민 화폐 보관용 지갑</div>
            </div>
          </div>
          <div class="bill-footer">
            <span class="serial-no">ID: VM-2026-PASS</span>
            <span class="footer-msg">가상 시장 공식 등록 회원</span>
          </div>
        </div>
      </div>
    </div>
    '''

def generate_guide_card():
    return f'''
    <div class="card special-card card-guide">
      <div class="crop-border">
        <div class="bill-inner">
          <div class="bill-header">
            <span class="badge-tag">RULES</span>
            <span class="bank-title">비타민 은행 환전 & 수칙</span>
            <span class="badge-tag">GUIDE</span>
          </div>
          <div class="special-body">
            <div class="illus-wrap-sm">
              {get_svg_guide()}
            </div>
            <div class="guide-content">
              <div class="rule-box">
                <b>10v</b> = <b>5v</b> × 2개 = <b>1v</b> × 10개
              </div>
              <div class="rule-item">✔ 거스름돈을 꼼꼼하게 확인해요</div>
              <div class="rule-item">✔ 웃으며 정직하게 거래해요!</div>
            </div>
          </div>
          <div class="bill-footer">
            <span class="serial-no">RULE-EXCHANGE</span>
            <span class="footer-msg">비타민 중앙은행 공인 수칙</span>
          </div>
        </div>
      </div>
    </div>
    '''

def generate_bonus_card():
    return f'''
    <div class="card special-card card-bonus">
      <div class="crop-border">
        <div class="bill-inner">
          <div class="bill-header">
            <span class="badge-tag">LUCKY</span>
            <span class="bank-title">★ 럭키 비타민 보너스 ★</span>
            <span class="badge-tag">BONUS</span>
          </div>
          <div class="special-body">
            <div class="illus-wrap-sm">
              {get_svg_bonus()}
            </div>
            <div class="bonus-content">
              <div class="bonus-title">특별 교환 / 찬스권</div>
              <div class="bonus-desc">마켓에서 원하는 혜택으로 1회 교환!</div>
              <div class="bonus-use">사용처: __________________</div>
            </div>
          </div>
          <div class="bill-footer">
            <span class="serial-no">LUCKY-VOUCHER</span>
            <span class="footer-msg">★ 행운의 비타민 티켓 ★</span>
          </div>
        </div>
      </div>
    </div>
    '''

def generate_html():
    # 열(Column) 단위로 완벽하게 정렬하여 구성:
    # Col 1: 1v (5장: 1~5)
    # Col 2: 1v (5장: 6~10)
    # Col 3: 5v (5장: 1~5)
    # Col 4: 10v (2장: 1~2) + 지갑(1장) + 환전안내(1장) + 럭키쿠폰(1장)
    # CSS grid-auto-flow: column; 으로 배치하면 위에서 아래로 각 열이 채워집니다!

    col1 = [generate_bill_1v(i) for i in range(1, 6)]
    col2 = [generate_bill_1v(i) for i in range(6, 11)]
    col3 = [generate_bill_5v(i) for i in range(1, 6)]
    col4 = [
        generate_bill_10v(1),
        generate_bill_10v(2),
        generate_wallet_card(),
        generate_guide_card(),
        generate_bonus_card()
    ]

    all_cards = col1 + col2 + col3 + col4
    grid_content = "\n".join(all_cards)

    html = f'''<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>가상 시장 비타민 화폐 세트</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&family=Noto+Sans+KR:wght@500;700;900&display=swap" rel="stylesheet">
  <style>
    @page {{
      size: A4 landscape;
      margin: 0;
    }}
    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }}
    body {{
      width: 297mm;
      height: 210mm;
      margin: 0;
      padding: 6.5mm 8mm;
      font-family: 'Montserrat', 'Noto Sans KR', 'Malgun Gothic', sans-serif;
      background-color: #ffffff;
      color: #212529;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }}

    /* Top Banner Header */
    .top-header {{
      height: 7.5mm;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 4mm;
      background: linear-gradient(90deg, #f8f9fa, #ebfbee 25%, #fff4e6 65%, #f3f0ff 90%, #f8f9fa);
      border: 1px solid #ced4da;
      border-radius: 4px;
      margin-bottom: 2mm;
    }}
    .cut-guide-tip {{
      font-size: 7.5pt;
      color: #495057;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 4px;
    }}
    .main-page-title {{
      font-size: 9.8pt;
      font-weight: 900;
      color: #1864ab;
      letter-spacing: -0.3px;
    }}
    .main-page-title span {{
      color: #f76707;
    }}
    .page-sub-info {{
      font-size: 7pt;
      font-weight: 700;
      color: #495057;
    }}
    .page-sub-info b {{
      color: #2b8a3e;
    }}

    /* 4 Columns x 5 Rows Grid with Column-First Flow */
    .grid-container {{
      display: grid;
      grid-template-columns: repeat(4, 67mm);
      grid-template-rows: repeat(5, 36.2mm);
      grid-auto-flow: column;
      column-gap: 4mm;
      row-gap: 2.2mm;
      justify-content: center;
    }}

    /* Card Box & Crop Marks */
    .card {{
      width: 67mm;
      height: 36.2mm;
      position: relative;
    }}
    .crop-border {{
      width: 100%;
      height: 100%;
      border: 0.6px dashed #adb5bd;
      border-radius: 4px;
      padding: 0.8mm;
      background-color: #ffffff;
      display: flex;
    }}

    .bill-inner {{
      width: 100%;
      height: 100%;
      border-radius: 3.5px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 1.2mm 2mm 1mm 2mm;
      position: relative;
      overflow: hidden;
      border-width: 1.2px;
      border-style: solid;
    }}

    /* Header Bar */
    .bill-header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 4mm;
      z-index: 2;
    }}
    .corner-val {{
      font-size: 7.5pt;
      font-weight: 900;
      font-family: 'Montserrat', sans-serif;
      padding: 0 1.5mm;
      border-radius: 2px;
    }}
    .bank-title {{
      font-size: 5.5pt;
      font-weight: 800;
      letter-spacing: 0.8px;
    }}

    /* Body Area */
    .bill-body {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 23mm;
      position: relative;
      z-index: 2;
    }}
    .illus-wrap {{
      width: 20mm;
      height: 20mm;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }}
    .bill-illus {{
      width: 100%;
      height: 100%;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.12));
    }}

    /* Main Center Info */
    .main-info {{
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 0 1mm;
    }}
    .kor-val {{
      font-size: 6.2pt;
      font-weight: 900;
      letter-spacing: -0.3px;
      line-height: 1;
      margin-bottom: 0.5mm;
    }}
    .center-val-wrap {{
      display: flex;
      align-items: baseline;
      justify-content: center;
      line-height: 0.85;
      margin-bottom: 0.5mm;
    }}
    .num-val {{
      font-size: 26pt;
      font-weight: 900;
      font-family: 'Montserrat', sans-serif;
      letter-spacing: -1px;
    }}
    .unit-val {{
      font-size: 15pt;
      font-weight: 900;
      font-family: 'Montserrat', sans-serif;
      margin-left: 0.5mm;
    }}
    .eng-val {{
      font-size: 5.5pt;
      font-weight: 900;
      font-family: 'Montserrat', sans-serif;
      letter-spacing: 1px;
      line-height: 1;
    }}

    /* Stamp */
    .stamp-wrap {{
      width: 13mm;
      height: 13mm;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      opacity: 0.88;
      transform: rotate(-5deg);
    }}
    .official-stamp {{
      width: 100%;
      height: 100%;
    }}

    /* Footer Bar */
    .bill-footer {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 3.5mm;
      border-top: 0.5px solid rgba(0,0,0,0.12);
      padding-top: 0.5mm;
      z-index: 2;
    }}
    .serial-no {{
      font-size: 5pt;
      font-weight: 700;
      font-family: 'Courier New', monospace;
      letter-spacing: 0.5px;
    }}
    .footer-msg {{
      font-size: 4.8pt;
      font-weight: 700;
    }}
    .security-text {{
      font-size: 4.8pt;
      font-weight: 800;
      letter-spacing: 0.5px;
    }}

    /* --- THEMES --- */

    /* 1v Theme: Fresh Lime & Lemon Green */
    .bill-1v .bill-inner {{
      background: linear-gradient(135deg, #f4fce3 0%, #ebfbee 35%, #fff9db 100%);
      border-color: #40c057;
      box-shadow: inset 0 0 0 0.8px #82c91e;
    }}
    .bill-1v .bank-title {{ color: #2b8a3e; }}
    .bill-1v .corner-val {{ background: #2f9e44; color: #ffffff; }}
    .bill-1v .kor-val {{ color: #2b8a3e; }}
    .bill-1v .num-val {{ color: #237032; text-shadow: 1px 1px 0px #b2f2bb; }}
    .bill-1v .unit-val {{ color: #2f9e44; }}
    .bill-1v .eng-val {{ color: #2f9e44; }}
    .bill-1v .serial-no {{ color: #2b8a3e; }}
    .bill-1v .footer-msg {{ color: #40c057; }}
    .bill-1v .security-text {{ color: #2b8a3e; }}

    /* 5v Theme: Energy Orange & Coral */
    .bill-5v .bill-inner {{
      background: linear-gradient(135deg, #fff4e6 0%, #ffe8cc 45%, #fff9db 100%);
      border-color: #f76707;
      box-shadow: inset 0 0 0 0.8px #fd7e14;
    }}
    .bill-5v .bank-title {{ color: #d9480f; }}
    .bill-5v .corner-val {{ background: #f76707; color: #ffffff; }}
    .bill-5v .kor-val {{ color: #d9480f; }}
    .bill-5v .num-val {{ color: #c92a2a; text-shadow: 1px 1px 0px #ffd8a8; }}
    .bill-5v .unit-val {{ color: #f76707; }}
    .bill-5v .eng-val {{ color: #d9480f; }}
    .bill-5v .serial-no {{ color: #d9480f; }}
    .bill-5v .footer-msg {{ color: #f76707; }}
    .bill-5v .security-text {{ color: #d9480f; }}

    /* 10v Theme: Royal Purple & Deep Blue & Gold */
    .bill-10v .bill-inner {{
      background: linear-gradient(135deg, #f3f0ff 0%, #edf2ff 50%, #fff9db 100%);
      border-color: #4c6ef5;
      box-shadow: inset 0 0 0 1px #fab005;
    }}
    .bill-10v .bank-title {{ color: #364fc7; }}
    .bill-10v .corner-val {{ background: #364fc7; color: #ffd43b; }}
    .bill-10v .kor-val {{ color: #364fc7; }}
    .bill-10v .num-val {{ color: #1864ab; text-shadow: 1px 1px 0px #d0bfff; }}
    .bill-10v .unit-val {{ color: #4c6ef5; }}
    .bill-10v .eng-val {{ color: #364fc7; }}
    .bill-10v .serial-no {{ color: #364fc7; }}
    .bill-10v .footer-msg {{ color: #5c7cfa; }}
    .bill-10v .security-text {{ color: #364fc7; }}

    /* --- SPECIAL CARDS (Column 4, Rows 3-5) --- */
    .special-card .bill-inner {{
      padding: 1.2mm 2mm 1mm 2mm;
    }}
    .badge-tag {{
      font-size: 5.5pt;
      font-weight: 900;
      padding: 0 1.5mm;
      border-radius: 2px;
      color: #fff;
    }}
    .special-body {{
      display: flex;
      align-items: center;
      height: 23mm;
      gap: 2mm;
      z-index: 2;
    }}
    .illus-wrap-sm {{
      width: 16mm;
      height: 16mm;
      flex-shrink: 0;
    }}
    .card-illus {{
      width: 100%;
      height: 100%;
    }}

    /* Wallet Card */
    .card-wallet .bill-inner {{
      background: linear-gradient(135deg, #e6fcf5 0%, #e3fafc 100%);
      border-color: #12b886;
    }}
    .card-wallet .badge-tag {{ background: #0ca678; }}
    .card-wallet .bank-title {{ color: #087f5b; font-size: 6pt; }}
    .wallet-form {{
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 1.2mm;
    }}
    .form-row {{
      display: flex;
      align-items: flex-end;
      font-size: 6.5pt;
      font-weight: 700;
      color: #212529;
    }}
    .form-label {{
      width: 14mm;
      flex-shrink: 0;
    }}
    .form-line {{
      flex-grow: 1;
      border-bottom: 1.2px solid #20c997;
      height: 3.5mm;
    }}
    .wallet-tip {{
      font-size: 5.2pt;
      color: #099268;
      font-weight: 700;
      margin-top: 0.5mm;
    }}
    .card-wallet .serial-no {{ color: #087f5b; }}
    .card-wallet .footer-msg {{ color: #0ca678; }}

    /* Guide Card */
    .card-guide .bill-inner {{
      background: linear-gradient(135deg, #e7f5ff 0%, #f1f3f5 100%);
      border-color: #1c7ed6;
    }}
    .card-guide .badge-tag {{ background: #1c7ed6; }}
    .card-guide .bank-title {{ color: #1864ab; font-size: 6pt; }}
    .guide-content {{
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 1mm;
    }}
    .rule-box {{
      background: #ffffff;
      border: 1px solid #74c0fc;
      border-radius: 3px;
      padding: 0.8mm;
      font-size: 5.8pt;
      text-align: center;
      color: #1864ab;
      font-weight: 700;
    }}
    .rule-box b {{
      color: #e67700;
    }}
    .rule-item {{
      font-size: 5.3pt;
      font-weight: 700;
      color: #495057;
      line-height: 1.2;
    }}
    .card-guide .serial-no {{ color: #1864ab; }}
    .card-guide .footer-msg {{ color: #1c7ed6; }}

    /* Bonus Card */
    .card-bonus .bill-inner {{
      background: linear-gradient(135deg, #fff9db 0%, #ffe3e3 100%);
      border-color: #f59f00;
      box-shadow: inset 0 0 0 1px #ff6b6b;
    }}
    .card-bonus .badge-tag {{ background: #f59f00; }}
    .card-bonus .bank-title {{ color: #e67700; font-size: 6pt; }}
    .bonus-content {{
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.8mm;
    }}
    .bonus-title {{
      font-size: 6.8pt;
      font-weight: 900;
      color: #d9480f;
      letter-spacing: -0.2px;
    }}
    .bonus-desc {{
      font-size: 5.2pt;
      color: #495057;
      font-weight: 700;
    }}
    .bonus-use {{
      font-size: 5.5pt;
      color: #212529;
      font-weight: 700;
      border-bottom: 1px dashed #ffa8a8;
      padding-bottom: 0.5mm;
    }}
    .card-bonus .serial-no {{ color: #f59f00; }}
    .card-bonus .footer-msg {{ color: #d9480f; }}

    /* Bottom Info */
    .bottom-info {{
      height: 4.5mm;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 4mm;
      font-size: 6.5pt;
      color: #495057;
      border-top: 0.5px dashed #ced4da;
      margin-top: 1.5mm;
    }}
    .bottom-info b {{
      color: #1864ab;
    }}
  </style>
</head>
<body>

  <!-- Top Banner Header -->
  <div class="top-header">
    <div class="cut-guide-tip">
      <span>✂️</span>
      <span>회색 점선을 따라 가위로 자르면 총 20장의 화폐 & 활동 카드가 완성됩니다.</span>
    </div>
    <div class="main-page-title">
      🍋 가상 시장 <span>비타민(Vitamin)</span> 공식 화폐 세트 🍊
    </div>
    <div class="page-sub-info">
      화폐 구성: <b>1v (10장)</b> · <b>5v (5장)</b> · <b>10v (2장)</b> + 활동 카드 (3장)
    </div>
  </div>

  <!-- 4 x 5 Grid Container (Column-First Flow) -->
  <div class="grid-container">
    {grid_content}
  </div>

  <!-- Bottom Info -->
  <div class="bottom-info">
    <span>🏛️ <b>비타민 중앙은행 (VITAMIN CENTRAL BANK)</b> | 가상 시장 및 경제 활동 교육용 공식 화폐</span>
    <span>💡 <b>출력 팁:</b> 두꺼운 용지(120g~180g)에 인쇄하거나 코팅하면 실제 지폐처럼 탄탄하게 오래 사용할 수 있습니다.</span>
  </div>

</body>
</html>
'''
    return html

def main():
    html_content = generate_html()
    html_path = "vitamin_currency.html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"HTML saved to {html_path}")

    # Desktop path
    desktop_dir = os.path.join(os.environ["USERPROFILE"], "Desktop")
    pdf_path = os.path.join(desktop_dir, "비타민_가상시장_화폐_A4.pdf")
    
    print(f"Generating PDF at {pdf_path}...")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(f"file:///{os.path.abspath(html_path)}")
        page.wait_for_load_state("networkidle")
        page.pdf(
            path=pdf_path,
            format="A4",
            landscape=True,
            print_background=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"}
        )
        browser.close()
    
    print("PDF generated successfully!")

    # Verify and render preview image using PyMuPDF
    doc = fitz.open(pdf_path)
    print(f"Page count: {len(doc)}")
    for i, page in enumerate(doc):
        rect = page.rect
        print(f"Page {i+1} size: {rect.width} x {rect.height} pt")
        pix = page.get_pixmap(dpi=150)
        preview_img = f"preview_page_{i+1}.png"
        pix.save(preview_img)
        print(f"Rendered preview image: {preview_img}")
    doc.close()

if __name__ == "__main__":
    main()
