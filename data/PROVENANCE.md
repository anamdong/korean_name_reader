# Data Provenance

This file describes the external data and reference material used by the
checked-in datasets and reading rules.

## Counts And Surname Data

- KOSIS Population and Housing Census, table `DT_1IN15SB` (2015): surname,
  surname-Hanja, population, and bon-gwan counts.
  https://kosis.kr/statHtml/statHtml.do?orgId=101&tblId=DT_1IN15SB&conn_path=I2
- Korean clan index: used to resolve bon-gwan labels to surname-specific Hanja.
  https://ph3588.tistory.com/4
- Historical-place index: used to cross-check bon-gwan place labels.
  https://www.surname.info/local.html

## Hanja And Modern Name Usage

- Unicode Unihan `kHangul`: fallback Korean readings for Hanja.
  https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip
- Oh My Baby 2025 and 2026 boy/girl ranking pages: rank-weighted modern
  given-name and representative-Hanja usage prior. This is not an official
  registry count.
  https://www.ohmybaby.kr/rankings

## Observed Name Forms And Kana

- English Wikipedia public Korean-person biography pages: observed Hangul,
  Roman, Hanja, and kana name forms in the compact name index.
  https://en.wikipedia.org/wiki/Category:South_Korean_people
- Japanese Wikipedia Korean surname list: preferred Japanese surname kana
  readings for the 204 supported surnames.
  https://ja.wikipedia.org/wiki/%E6%9C%9D%E9%AE%AE%E4%BA%BA%E3%81%AE%E5%A7%93%E3%81%AE%E4%B8%80%E8%A6%A7
- Japanese Wikipedia public name pages: supporting evidence for selected kana
  pronunciation conventions. See `SURNAME_KANA_SOURCES.md` and
  `KANA_PRONUNCIATION_SOURCES.md` for rule-level notes.

## Romanization And Audio

- National Institute of Korean Language: Revised Romanization reference.
  https://www.korean.go.kr/front_eng/roman/roman_01.do
- Browser speech synthesis is preferred for pronunciation playback. When it is
  unavailable, the app can request Naver Dictionary audio. This is a playback
  integration, not a ranking or name-data source.

## Provenance Limitation

The checked-in name index retains some legacy historical-period markers (for
example, 1970, 1980, and 1990) whose original acquisition URLs were not
preserved in this workspace. They are retained only as broad name-evidence
signals and are not presented as official historical statistics.

Spelling aliases and kana variants implemented in `app.js` are curated
compatibility rules. They expand search coverage but do not alter source totals.
