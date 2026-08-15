import { analyzeLatinNameInput, createKoreanRomanSuggestionIndex, isKoreanRomanShorthand, keyboardWeightedDistance } from "./name_input_helpers.js?v=20260814-chinese-guidance-3";
import { clanIdForHangnyeol, findHangnyeolMatches, sourceRecordsForHangnyeolMatch } from "./hangnyeol_matcher.js?v=20260813-hangnyeol-2";

const dataUrl = "./data/name_index.json?v=20260804-japanese-surname-priors";
const hanjaReadingUrl = "./data/hanja_readings.json?v=20260721-unihan-khangul";
const hanjaNameCharUrl = "./data/hanja_name_chars.json?v=20260721-top1000-name-hanja";
const hanjaUsageRankUrl = "./data/hanja_usage_rank.json?v=20260721-ohmybaby-top50";
const bonGwanDataUrl = "./data/bon_gwan_by_surname.json?v=20260721-kosis-2015-hanja";
const hangnyeolDataUrl = "./data/hangnyeol_by_clan.json?v=20260813-corpus-6";

const LANGUAGE_STORAGE_KEY = "gildonghong.language";
const SEARCH_HISTORY_STORAGE_KEY = "gildonghong.searchHistory";
const SEARCH_HISTORY_LIMIT = 5;
const SEARCH_HISTORY_COMPACT_VISIBLE_COUNT = 2;
const RESULTS_REVEAL_DELAY_MS = 430;
const RESULTS_SWAP_FADE_MS = 220;
const LANGUAGE_CONFIG = {
  en: { code: "EN", htmlLang: "en", intlLocale: "en" },
  ja: { code: "JP", htmlLang: "ja", intlLocale: "ja-JP" },
  zh: { code: "ZH", htmlLang: "zh-Hant", intlLocale: "zh-TW" },
};

const TRANSLATIONS = {
  en: {
    languageSelectorLabel: "Choose language",
    siteSectionsLabel: "Site sections",
    home: "Home",
    about: "About",
    howItWorks: "How it works",
    promptAriaLabel: "How do I read this Korean name?",
    promptPrefix: "How do I read",
    promptSuffix: "?",
    typewriterSearchAria: ({ name }) => `Search for ${name}`,
    searchAriaLabel: "Korean name search",
    searchLabel: "Korean name",
    searchPlaceholder: "Search a Korean name",
    convert: "Convert",
    examples: "Examples",
    history: "History",
    clearAll: "Clear all",
    removeHistoryItem: ({ name }) => `Remove ${name} from history`,
    rankedResults: "Ranked results",
    plausibility: "Plausibility",
    romanAlphabet: "Roman alphabet",
    japaneseKana: "Japanese kana",
    hanja: "Hanja",
    kindSurname: "surname",
    kindGiven: "given name",
    kindFull: "full name",
    supportingRows: ({ count }) => `${count} supporting dataset row${count === 1 ? "" : "s"}`,
    generatedGivenEvidence: "generated from given-name evidence",
    surnameSubtitle: ({ population, evidence }) => `Surname match · population ${population} · ${evidence}`,
    givenSubtitle: ({ count, evidence }) => `${count}-syllable given name · ${evidence}`,
    ambiguousStandaloneSubtitle: ({ count, population }) =>
      `Used as a ${count}-syllable given name or surname · surname population ${population}`,
    fullSubtitle: ({ surname, given, evidence }) => evidence ? `Surname ${surname} · Given ${given} · ${evidence}` : `Surname ${surname} · Given ${given}`,
    interpretationNone: "Interpretation: likely neither a surname, given name, nor full name.",
    interpretationLikely: ({ kind }) => `Interpretation: likely ${kind}.`,
    interpretationAmbiguous: ({ kinds }) => `Interpretation: ambiguous between ${kinds}.`,
    noMatches: "No matches found. Try a shorter name or another spelling.",
    dismissInputGuidance: "Dismiss message",
    inputSuggestionPrefix: "Did you mean",
    inputSuggestionSuffix: "?",
    possibleChineseRomanization: "The name you're looking for might not be Korean. It may use a Chinese romanization.",
    pronunciationAria: ({ name }) => `Play Korean pronunciation for ${name}`,
    playPronunciation: "Play pronunciation",
    pronunciationUnavailable: "Pronunciation unavailable",
    noOutput: "No output",
    noHanjaObserved: "No observed Hanja reading in the dataset",
    aboutTitle: "About gildonghong",
    creatorCredit: "Created by James Hyungjune Seo",
    aboutDoesTitle: "What it does",
    aboutDoesSearch: "Ranks plausible names used primarily in modern South Korea from several writing systems.",
    aboutDoesOutputs: "Shows Roman-letter, Japanese-kana, and Hanja variants when evidence is available.",
    aboutDoesAudio: "Plays Korean pronunciation for each result.",
    aboutUseTitle: "How to search",
    aboutUseStepOne: "Enter one surname, one given name, or a full name.",
    aboutUseStepTwo: "Use spaces, hyphens, or familiar personal spellings in Roman letters.",
    aboutUseStepThree: "Open a result to compare its scripts and evidence.",
    aboutExamplesLabel: "Search examples",
    formatHangul: "Hangul",
    formatRoman: "Roman letters",
    formatKana: "Japanese kana",
    formatHanja: "Hanja",
    aboutRankingTitle: "How ranking works",
    aboutRankingEvidence: "Candidates combine surname population, modern given-name evidence, script readings, and observed spellings.",
    aboutRankingMeaning: "Plausibility compares the candidates shown. It is not a population probability.",
    aboutRankingLimit: "Personal spellings vary, so a lower-ranked result can still be correct.",
    aboutBonGwanTitle: "Bon-gwan data",
    aboutBonGwanCopy: "Bon-gwan means an ancestral clan seat. Shares are calculated within one exact Hangul-Hanja surname, so 유(柳) and 유(劉) use separate totals.",
    aboutBonGwanYear: "The latest official surname and bon-gwan table available is the 2015 census.",
    aboutBonGwanOther: "The source combines bon-gwan with fewer than 1,000 people as Other.",
    aboutSourcesTitle: "Sources",
    sourceKosisName: "KOSIS · 2015 Population and Housing Census",
    sourceKosisDescription: "Surname, Hanja surname, population, and bon-gwan counts.",
    sourceUnihanName: "Unicode Unihan Database",
    sourceUnihanDescription: "kHangul readings used as a Hanja fallback.",
    sourceRomanizationName: "National Institute of Korean Language",
    sourceRomanizationDescription: "Revised Romanization reference.",
    sourceNamesName: "Oh My Baby · 2025-2026 name rankings",
    sourceNamesDescription: "Rank-weighted modern-name and representative Hanja usage prior. It is not an official registry count.",
    sourceWikipediaName: "Wikipedia · Korean-person name corpus",
    sourceWikipediaDescription: "Public biography pages provide observed Hangul, Roman, Hanja, and kana forms.",
    sourceJapaneseName: "Japanese Wikipedia · Korean surname list",
    sourceJapaneseDescription: "Preferred Japanese surname kana readings and supporting kana conventions.",
    sourceClanIndexName: "Korean bon-gwan clan index",
    sourceClanIndexDescription: "Used to annotate bon-gwan Hanja labels; population counts remain from KOSIS.",
    sourcePlaceIndexName: "surname.info · Historical-place index",
    sourcePlaceIndexDescription: "Used to cross-check bon-gwan place labels; population counts remain from KOSIS.",
    sourceMethodNote: "Some legacy historical-period markers in the checked-in name index have no preserved source URL. They are used only as broad name evidence, not presented as official statistics. Additional spelling aliases and kana variants are curated compatibility rules.",
    howTitle: "How it works",
    howIntro: "The tool turns a search string into possible Korean names, then ranks the candidates by matching evidence from several writing systems.",
    howTokenTitle: "1. It reads the input as evidence",
    howTokenCopy: "The search is split by script and separators, so Hangul, Roman letters, Japanese kana, and Hanja can all be used alone or together.",
    howTokenRoman: "Roman input accepts surname-first and surname-last order, spaces, dots, hyphens, and curated personal spellings.",
    howTokenKana: "Kana input is matched against common Japanese ways of writing Korean sounds, including liaison and small-tsu variants.",
    howTokenHanja: "Hanja input uses observed Korean name characters first, then falls back to Korean readings when needed.",
    howCandidateTitle: "2. It builds Korean-name candidates",
    howCandidateCopy: "The system combines possible surnames and given-name syllables, then removes candidates that do not look like modern Korean names.",
    howCandidateSurname: "Surname candidates use Korean census population, Hanja surname data, and curated Korean-only spelling aliases.",
    howCandidateGiven: "Given names use modern name evidence, syllable evidence, representative Hanja, and attested spelling examples.",
    howCandidateFilter: "Filters reject many false positives, including unsupported syllables and non-Korean Sinosphere romanizations.",
    howRankTitle: "3. It ranks by plausibility",
    howRankCopy: "The score is a comparison among the shown candidates, not a claim about the real-world probability of a person having that exact name.",
    howRankPopulation: "Common surnames and well-supported given names get stronger priors.",
    howRankExact: "Exact observed spellings and exact Hanja/kana matches get additional weight.",
    howRankRare: "Rare aliases are allowed so real personal spellings can be found, but they are kept weaker than standard spellings.",
    howOutputTitle: "4. It formats the result",
    howOutputCopy: "For each ranked Korean candidate, the page shows likely Roman spellings, Japanese kana, Hanja options, bon-gwan distribution when available, and Korean pronunciation playback.",
    bonGwanDistribution: "Bon-gwan distribution",
    bonGwanEntryCount: ({ count }) => `${count} entr${count === 1 ? "y" : "ies"}`,
    bonGwanScope: ({ surname, population, year }) => `Share within ${surname} · ${population} people · ${year} census`,
    bonGwanNameLabel: "Bon-gwan",
    bonGwanShareLabel: "Share",
    bonGwanPeopleLabel: "People",
    bonGwanOther: "Other (combined)",
    bonGwanSource: ({ year }) => `Source: KOSIS ${year} census`,
    bonGwanCombinedNote: "KOSIS combines bon-gwan with fewer than 1,000 people as Other.",
    hangnyeolMatchCount: ({ count }) => `✦ ${count} generation-name match${count === 1 ? "" : "es"}`,
    hangnyeolExactMatchCount: ({ count }) => `✦ ${count} exact Hanja generation-name match${count === 1 ? "" : "es"}`,
    hangnyeolPossibleMatch: "Possible generation-name match",
    hangnyeolExactMatch: "Exact Hanja generation-name match",
    hangnyeolMatchWithinBranch: ({ branch }) => `Possible match within ${branch}`,
    hangnyeolGeneration: ({ generation }) => `${generation}th generation`,
    hangnyeolPublishedPattern: "Published pattern",
    hangnyeolWhyItMatches: "Why it matches",
    hangnyeolClan: ({ clan, surname }) => `${clan} · surname Hanja ${surname}`,
    hangnyeolMatchStrength: "Match strength",
    hangnyeolStrengthExact: "Exact Hanja",
    hangnyeolStrengthPossible: "Hangul reading only",
    hangnyeolFirstPositionMatch: ({ given, character }) => `${given} begins with ${character}, matching this first-position generation-name pattern.`,
    hangnyeolSecondPositionMatch: ({ given, character }) => `${given} ends with ${character}, matching this second-position generation-name pattern.`,
    hangnyeolExactHanjaReason: "The Hanja used in this name exactly matches the published generation character.",
    hangnyeolReadingReason: "This is a Hangul-reading match. The Hanja used in this name is not known, so the match is not exact.",
    hangnyeolSource: "Source",
    hangnyeolLimit: "This does not establish a person's bon-gwan or ancestry. Modern names can coincidentally match traditional generation-name patterns.",
    loadFailed: "Could not load the search data. Reload the page and try again.",
  },
  ja: {
    languageSelectorLabel: "言語を選択",
    siteSectionsLabel: "サイト内メニュー",
    home: "ホーム",
    about: "このツールについて",
    howItWorks: "仕組み",
    promptAriaLabel: "この韓国人名はどう読みますか？",
    promptPrefix: "「",
    promptSuffix: "」はどう読む？",
    typewriterSearchAria: ({ name }) => `「${name}」を検索`,
    searchAriaLabel: "韓国人名を検索",
    searchLabel: "韓国人名",
    searchPlaceholder: "韓国人名を検索",
    convert: "変換",
    examples: "例",
    history: "履歴",
    clearAll: "すべて削除",
    removeHistoryItem: ({ name }) => `「${name}」を履歴から削除`,
    rankedResults: "候補ランキング",
    plausibility: "確からしさ",
    romanAlphabet: "ローマ字",
    japaneseKana: "日本語カナ",
    hanja: "漢字",
    kindSurname: "姓",
    kindGiven: "名",
    kindFull: "姓名",
    supportingRows: ({ count }) => `データセットの根拠 ${count}件`,
    generatedGivenEvidence: "名の用例から生成",
    surnameSubtitle: ({ population, evidence }) => `姓の一致 · 人口 ${population} · ${evidence}`,
    givenSubtitle: ({ count, evidence }) => `${count}音節の名 · ${evidence}`,
    ambiguousStandaloneSubtitle: ({ count, population }) =>
      `${count}音節の名、または姓として使用 · 姓の人口 ${population}`,
    fullSubtitle: ({ surname, given, evidence }) => evidence ? `姓 ${surname} · 名 ${given} · ${evidence}` : `姓 ${surname} · 名 ${given}`,
    interpretationNone: "判定：姓、名、姓名のいずれにも該当しない可能性があります。",
    interpretationLikely: ({ kind }) => `判定：${kind}の可能性が高いです。`,
    interpretationAmbiguous: ({ kinds }) => `判定：${kinds}の可能性があります。`,
    noMatches: "一致する候補が見つかりません。名前を短くするか、別の表記をお試しください。",
    dismissInputGuidance: "メッセージを閉じる",
    inputSuggestionPrefix: "「",
    inputSuggestionSuffix: "」のことですか？",
    possibleChineseRomanization: "お探しの名前は韓国人名ではない可能性があります。中国語のローマ字表記かもしれません。",
    pronunciationAria: ({ name }) => `${name}の韓国語の発音を再生`,
    playPronunciation: "発音を再生",
    pronunciationUnavailable: "発音を再生できません",
    noOutput: "出力なし",
    noHanjaObserved: "データセットに該当する漢字表記がありません",
    aboutTitle: "gildonghongについて",
    creatorCredit: "作成者：James Hyungjune Seo",
    aboutDoesTitle: "できること",
    aboutDoesSearch: "複数の表記から、主に現代の大韓民国における人名として確からしい候補を順位付けします。",
    aboutDoesOutputs: "根拠がある場合は、ローマ字、日本語カナ、漢字の表記候補を表示します。",
    aboutDoesAudio: "各候補の韓国語発音を再生します。",
    aboutUseTitle: "検索方法",
    aboutUseStepOne: "姓、名、または姓名を入力します。",
    aboutUseStepTwo: "ローマ字では、空白、ハイフン、本人が使うつづりも検索できます。",
    aboutUseStepThree: "結果を開き、表記と根拠を比較します。",
    aboutExamplesLabel: "検索例",
    formatHangul: "ハングル",
    formatRoman: "ローマ字",
    formatKana: "日本語カナ",
    formatHanja: "漢字",
    aboutRankingTitle: "順位の決め方",
    aboutRankingEvidence: "姓の人口、近年の名の用例、各表記の読み、実際のつづりを組み合わせます。",
    aboutRankingMeaning: "確からしさは表示候補どうしの比較です。人口における確率ではありません。",
    aboutRankingLimit: "個人のつづりには幅があるため、下位の候補が正しい場合もあります。",
    aboutBonGwanTitle: "本貫データ",
    aboutBonGwanCopy: "本貫は一族の発祥地を示します。割合は同じハングル・漢字の姓ごとに計算するため、ユ（柳）とユ（劉）は別集計です。",
    aboutBonGwanYear: "利用できる最新の公式な姓・本貫表は、2015年国勢調査です。",
    aboutBonGwanOther: "人口1,000人未満の本貫は、出典では「その他」に合算されています。",
    aboutSourcesTitle: "出典",
    sourceKosisName: "KOSIS · 2015年人口住宅総調査",
    sourceKosisDescription: "姓、姓の漢字、人口、本貫別人口。",
    sourceUnihanName: "Unicode Unihan Database",
    sourceUnihanDescription: "漢字検索の補助に用いるkHangul読み。",
    sourceRomanizationName: "韓国国立国語院",
    sourceRomanizationDescription: "韓国語ローマ字表記法の参照資料。",
    sourceNamesName: "Oh My Baby · 2025-2026年名前ランキング",
    sourceNamesDescription: "順位を重み付けした、近年の名と代表的な漢字の使用傾向です。公的な登録件数ではありません。",
    sourceWikipediaName: "Wikipedia · 韓国人名の公開ページ",
    sourceWikipediaDescription: "公開人物ページから、ハングル、ローマ字、漢字、カナの実例表記を参照しています。",
    sourceJapaneseName: "日本語版Wikipedia · 朝鮮人の姓の一覧",
    sourceJapaneseDescription: "姓の優先カナ表記と、補助的なカナ表記の慣例を参照しています。",
    sourceClanIndexName: "韓国の本貫索引",
    sourceClanIndexDescription: "本貫ラベルの漢字照合に使用します。人口値はKOSISのままです。",
    sourcePlaceIndexName: "surname.info · 本貫の地名索引",
    sourcePlaceIndexDescription: "本貫ラベルの地名照合に使用します。人口値はKOSISのままです。",
    sourceMethodNote: "チェックイン済みの名前インデックスには、元のURLが残っていない一部の過去年代マーカーも含まれます。これは広い候補判定だけに使い、公的統計値としては表示しません。つづりとカナ表記の一部は、検索範囲を広げるための整理済み互換規則です。",
    howTitle: "仕組み",
    howIntro: "入力された文字列から韓国人名の候補を作り、複数の表記体系から得られる根拠を照合して順位付けします。",
    howTokenTitle: "1. 入力を根拠として読む",
    howTokenCopy: "検索語を文字種と区切りで分けるため、ハングル、ローマ字、日本語カナ、漢字を単独でも組み合わせても使えます。",
    howTokenRoman: "ローマ字では、姓が前・後ろの両方、空白、ピリオド、ハイフン、整理済みの個人表記に対応します。",
    howTokenKana: "カナは、韓国語音を日本語で書く一般的な表記に照合し、連音や促音の揺れも扱います。",
    howTokenHanja: "漢字は、観測された韓国人名用字を優先し、必要に応じて韓国語読みへフォールバックします。",
    howCandidateTitle: "2. 韓国人名候補を作る",
    howCandidateCopy: "可能な姓と名の音節を組み合わせ、現代韓国人名らしくない候補を除外します。",
    howCandidateSurname: "姓候補は、韓国の人口統計、姓の漢字データ、韓国名に限定した表記別名を使います。",
    howCandidateGiven: "名は、近年の名の用例、音節ごとの根拠、代表的な漢字、実例のあるつづりを使います。",
    howCandidateFilter: "未対応の音節や、韓国名ではない中華圏・ベトナム系ローマ字表記など、多くの誤検出を除外します。",
    howRankTitle: "3. 確からしさで並べる",
    howRankCopy: "スコアは表示された候補どうしの比較であり、その人が実際にその名前である確率ではありません。",
    howRankPopulation: "人口の多い姓や、根拠の強い名には高い事前評価を与えます。",
    howRankExact: "観測済みのつづり、漢字、カナに完全一致する場合は追加の重みを与えます。",
    howRankRare: "珍しい別表記も検索できるようにしますが、標準的な表記より弱く扱います。",
    howOutputTitle: "4. 結果を整える",
    howOutputCopy: "各候補について、ローマ字、日本語カナ、漢字候補、利用可能な場合は本貫分布、韓国語発音の再生を表示します。",
    bonGwanDistribution: "本貫分布",
    bonGwanEntryCount: ({ count }) => `${count}件`,
    bonGwanScope: ({ surname, population, year }) => `${surname}内の割合 · ${population}人 · ${year}年調査`,
    bonGwanNameLabel: "本貫",
    bonGwanShareLabel: "割合",
    bonGwanPeopleLabel: "人口",
    bonGwanOther: "その他（合算）",
    bonGwanSource: ({ year }) => `出典：KOSIS ${year}年人口住宅総調査`,
    bonGwanCombinedNote: "KOSISでは人口1,000人未満の本貫を「その他」に合算しています。",
    hangnyeolMatchCount: ({ count }) => `✦ 行列字一致 ${count}件`,
    hangnyeolExactMatchCount: ({ count }) => `✦ 漢字が完全一致する行列字候補 ${count}件`,
    hangnyeolPossibleMatch: "行列字の一致候補",
    hangnyeolExactMatch: "漢字が完全一致する行列字候補",
    hangnyeolMatchWithinBranch: ({ branch }) => `${branch}での一致候補`,
    hangnyeolGeneration: ({ generation }) => `${generation}世`,
    hangnyeolPublishedPattern: "公開されている字配り",
    hangnyeolWhyItMatches: "一致の理由",
    hangnyeolClan: ({ clan, surname }) => `${clan} · 姓の漢字 ${surname}`,
    hangnyeolMatchStrength: "一致の強さ",
    hangnyeolStrengthExact: "漢字が完全一致",
    hangnyeolStrengthPossible: "ハングルの読みのみ",
    hangnyeolFirstPositionMatch: ({ given, character }) => `${given}は${character}で始まり、この一字目の行列字と一致します。`,
    hangnyeolSecondPositionMatch: ({ given, character }) => `${given}は${character}で終わり、この二字目の行列字と一致します。`,
    hangnyeolExactHanjaReason: "この名前で使われている漢字は、公開されている行列字と完全に一致します。",
    hangnyeolReadingReason: "これはハングルの読みが一致する候補です。この名前に使われた漢字は不明なため、完全一致ではありません。",
    hangnyeolSource: "出典",
    hangnyeolLimit: "これは本貫や祖先関係を証明するものではありません。現代の名前が伝統的な行列字と偶然一致することがあります。",
    loadFailed: "検索データを読み込めませんでした。ページを再読み込みしてください。",
  },
  zh: {
    languageSelectorLabel: "選擇語言",
    siteSectionsLabel: "網站分頁",
    home: "首頁",
    about: "關於",
    howItWorks: "運作方式",
    promptAriaLabel: "這個韓國姓名怎麼讀？",
    promptPrefix: "“",
    promptSuffix: "”怎麼讀？",
    typewriterSearchAria: ({ name }) => `搜尋${name}`,
    searchAriaLabel: "搜尋韓國姓名",
    searchLabel: "韓國姓名",
    searchPlaceholder: "搜尋韓國姓名",
    convert: "轉換",
    examples: "範例",
    history: "紀錄",
    clearAll: "全部清除",
    removeHistoryItem: ({ name }) => `從紀錄移除${name}`,
    rankedResults: "候選結果",
    plausibility: "可信度",
    romanAlphabet: "羅馬字母",
    japaneseKana: "日文假名",
    hanja: "漢字",
    kindSurname: "姓氏",
    kindGiven: "名字",
    kindFull: "完整姓名",
    supportingRows: ({ count }) => `${count} 筆資料集證據`,
    generatedGivenEvidence: "根據名字用例生成",
    surnameSubtitle: ({ population, evidence }) => `姓氏相符 · 人口 ${population} · ${evidence}`,
    givenSubtitle: ({ count, evidence }) => `${count} 音節名字 · ${evidence}`,
    ambiguousStandaloneSubtitle: ({ count, population }) =>
      `可作 ${count} 音節名字或姓氏 · 姓氏人口 ${population}`,
    fullSubtitle: ({ surname, given, evidence }) => evidence ? `姓氏 ${surname} · 名字 ${given} · ${evidence}` : `姓氏 ${surname} · 名字 ${given}`,
    interpretationNone: "判斷：很可能不是姓氏、名字或完整姓名。",
    interpretationLikely: ({ kind }) => `判斷：很可能是${kind}。`,
    interpretationAmbiguous: ({ kinds }) => `判斷：可能是${kinds}之一。`,
    noMatches: "找不到相符結果。請縮短姓名或嘗試其他拼寫。",
    dismissInputGuidance: "關閉訊息",
    inputSuggestionPrefix: "您是否想查詢「",
    inputSuggestionSuffix: "」？",
    possibleChineseRomanization: "您查詢的姓名可能不是韓國人名，可能使用了中文羅馬字拼寫。",
    pronunciationAria: ({ name }) => `播放${name}的韓語發音`,
    playPronunciation: "播放發音",
    pronunciationUnavailable: "無法播放發音",
    noOutput: "無輸出",
    noHanjaObserved: "資料集中沒有對應的漢字寫法",
    aboutTitle: "關於 gildonghong",
    creatorCredit: "製作者：James Hyungjune Seo",
    aboutDoesTitle: "功能",
    aboutDoesSearch: "依多種書寫方式，排列主要在現代大韓民國使用的人名候選。",
    aboutDoesOutputs: "有資料依據時，顯示羅馬字母、日文假名與漢字寫法。",
    aboutDoesAudio: "播放各結果的韓語發音。",
    aboutUseTitle: "搜尋方式",
    aboutUseStepOne: "輸入一個姓、名字或完整姓名。",
    aboutUseStepTwo: "羅馬字母可使用空格、連字號或個人慣用拼法。",
    aboutUseStepThree: "開啟結果，比較不同寫法與資料依據。",
    aboutExamplesLabel: "搜尋範例",
    formatHangul: "韓文",
    formatRoman: "羅馬字母",
    formatKana: "日文假名",
    formatHanja: "漢字",
    aboutRankingTitle: "排序方式",
    aboutRankingEvidence: "候選結果綜合姓氏人口、現代名字資料、各文字讀音與實際拼法。",
    aboutRankingMeaning: "可信度只比較目前顯示的候選結果，並非人口機率。",
    aboutRankingLimit: "個人拼法不盡相同，因此較低順位也可能正確。",
    aboutBonGwanTitle: "本貫資料",
    aboutBonGwanCopy: "本貫代表宗族的發祥地。比例依完全相同的韓文與漢字姓氏分別計算，因此 유（柳）與 유（劉）採用不同總數。",
    aboutBonGwanYear: "目前可用的最新官方姓氏與本貫資料表來自2015年人口住宅總調查。",
    aboutBonGwanOther: "資料來源將人口少於1,000人的本貫合併為「其他」。",
    aboutSourcesTitle: "資料來源",
    sourceKosisName: "KOSIS · 2015年人口住宅總調查",
    sourceKosisDescription: "姓氏、姓氏漢字、人口與各本貫人口。",
    sourceUnihanName: "Unicode Unihan Database",
    sourceUnihanDescription: "作為漢字搜尋後備資料的kHangul讀音。",
    sourceRomanizationName: "韓國國立國語院",
    sourceRomanizationDescription: "韓語羅馬字表記法參考。",
    sourceNamesName: "Oh My Baby · 2025-2026年姓名排行",
    sourceNamesDescription: "以排名加權的現代名字與代表漢字使用傾向，不是官方登記件數。",
    sourceWikipediaName: "Wikipedia · 韓國人物姓名資料",
    sourceWikipediaDescription: "公開人物頁面提供韓文、羅馬字、漢字與假名的實際表記。",
    sourceJapaneseName: "日文 Wikipedia · 朝鮮人姓氏列表",
    sourceJapaneseDescription: "用於姓氏的優先日文假名讀法與輔助假名慣例。",
    sourceClanIndexName: "韓國本貫索引",
    sourceClanIndexDescription: "用於標註本貫漢字；人口數仍以 KOSIS 為準。",
    sourcePlaceIndexName: "surname.info · 歷史地名索引",
    sourcePlaceIndexDescription: "用於交叉核對本貫地名標籤；人口數仍以 KOSIS 為準。",
    sourceMethodNote: "已納入的姓名索引含有部分未保留原始網址的歷史年代標記。這些資料只作為廣泛的姓名證據，不會作為官方統計呈現。部分拼寫別名與假名變體則是人工整理的相容規則。",
    howTitle: "運作方式",
    howIntro: "此工具會把搜尋字串轉成可能的韓國姓名，並依多種書寫系統的證據排列候選結果。",
    howTokenTitle: "1. 將輸入視為證據",
    howTokenCopy: "搜尋內容會依文字系統與分隔符切分，因此韓文、羅馬字母、日文假名與漢字可以單獨或混合使用。",
    howTokenRoman: "羅馬字母輸入支援姓在前、姓在後、空格、句點、連字號，以及人工整理的個人拼法。",
    howTokenKana: "假名輸入會比對日文中常見的韓國語音寫法，包括連音與促音變體。",
    howTokenHanja: "漢字輸入優先使用觀測到的韓國姓名用字，必要時再退回韓語讀音。",
    howCandidateTitle: "2. 建立韓國姓名候選",
    howCandidateCopy: "系統會組合可能的姓氏與名字音節，並移除不像現代韓國姓名的候選。",
    howCandidateSurname: "姓氏候選使用韓國人口統計、姓氏漢字資料，以及限定為韓國名的人工拼寫別名。",
    howCandidateGiven: "名字使用現代名字資料、音節證據、代表漢字與實際出現過的拼法。",
    howCandidateFilter: "篩選規則會排除許多誤判，包括不支援的音節與非韓國姓名的中華圈或越南式羅馬字。",
    howRankTitle: "3. 依可信度排序",
    howRankCopy: "分數只比較目前顯示的候選結果，並不代表某人實際使用該姓名的真實機率。",
    howRankPopulation: "常見姓氏與資料支持較強的名字會有較高的先驗權重。",
    howRankExact: "完全符合觀測拼法、漢字或假名時會增加權重。",
    howRankRare: "系統允許罕見別名以便找到真實個人拼法，但其權重低於標準拼法。",
    howOutputTitle: "4. 整理輸出結果",
    howOutputCopy: "每個韓國姓名候選會顯示可能的羅馬拼法、日文假名、漢字候選、可用時的本貫分布，以及韓語發音播放。",
    bonGwanDistribution: "本貫分布",
    bonGwanEntryCount: ({ count }) => `${count}項`,
    bonGwanScope: ({ surname, population, year }) => `${surname}內的比例 · ${population}人 · ${year}年調查`,
    bonGwanNameLabel: "本貫",
    bonGwanShareLabel: "比例",
    bonGwanPeopleLabel: "人口",
    bonGwanOther: "其他（合併）",
    bonGwanSource: ({ year }) => `來源：KOSIS ${year}年人口普查`,
    bonGwanCombinedNote: "KOSIS將人口少於1,000人的本貫合併為「其他」。",
    hangnyeolMatchCount: ({ count }) => `✦ ${count} 項行列字相符`,
    hangnyeolExactMatchCount: ({ count }) => `✦ ${count} 項行列字漢字完全相符`,
    hangnyeolPossibleMatch: "可能的行列字相符",
    hangnyeolExactMatch: "行列字漢字完全相符",
    hangnyeolMatchWithinBranch: ({ branch }) => `${branch}內可能相符`,
    hangnyeolGeneration: ({ generation }) => `第${generation}世`,
    hangnyeolPublishedPattern: "已公布的行列字格式",
    hangnyeolWhyItMatches: "相符原因",
    hangnyeolClan: ({ clan, surname }) => `${clan} · 姓氏漢字 ${surname}`,
    hangnyeolMatchStrength: "相符強度",
    hangnyeolStrengthExact: "漢字完全相符",
    hangnyeolStrengthPossible: "僅限韓文讀音",
    hangnyeolFirstPositionMatch: ({ given, character }) => `${given}以${character}開頭，符合此第一字行列字格式。`,
    hangnyeolSecondPositionMatch: ({ given, character }) => `${given}以${character}結尾，符合此第二字行列字格式。`,
    hangnyeolExactHanjaReason: "此姓名所用漢字與已公布的行列字完全相符。",
    hangnyeolReadingReason: "這是韓文讀音相符；此姓名所用漢字未知，因此並非完全相符。",
    hangnyeolSource: "來源",
    hangnyeolLimit: "這不代表能證明個人的本貫或祖源。現代姓名可能偶然符合傳統行列字格式。",
    loadFailed: "無法載入搜尋資料。請重新整理頁面後再試。",
  },
};

function normalizeLanguage(value) {
  const language = String(value || "").toLowerCase();
  if (language.startsWith("ja")) return "ja";
  if (language.startsWith("zh")) return "zh";
  return "en";
}

function resolveInitialLanguage() {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && LANGUAGE_CONFIG[saved]) return saved;
  } catch {
    // Storage may be unavailable in privacy-restricted contexts.
  }
  return normalizeLanguage(typeof navigator !== "undefined" ? navigator.language : "en");
}

const state = {
  data: null,
  runtime: null,
  bonGwanData: null,
  hangnyeolData: null,
  hangnyeolQueryHanja: "",
  queryMeta: null,
  dismissedInputGuidanceQuery: null,
  language: resolveInitialLanguage(),
};

const scriptPatterns = {
  hangul: /[가-힣]/g,
  latin: /[A-Za-zÀ-ȳŏŭŎŬ]/g,
  kana: /[ァ-ヶー゛゜ぁ-ゖゝゞ]/g,
  hanja: /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g,
};

const resultTemplate = document.querySelector("#result-template");
const homePanelEl = document.querySelector("#home-panel");
const resultsSectionEl = document.querySelector(".results-section");
const resultsEl = document.querySelector("#results");
const interpretationEl = document.querySelector("#query-interpretation");
const inputGuidanceEl = document.querySelector("#input-guidance");
const queryEl = document.querySelector("#query");
const formEl = document.querySelector("#search-form");
const exampleChipEls = Array.from(document.querySelectorAll(".example-chip"));
const historySectionEl = document.querySelector("#history-section");
const historyListEl = document.querySelector("#history-list");
const clearHistoryEl = document.querySelector("#clear-history");
const typewriterNameEl = document.querySelector("#typewriter-name");
const languageSelectorEl = document.querySelector(".language-selector");
const languageTriggerEl = document.querySelector("#language-trigger");
const languageMenuEl = document.querySelector("#language-menu");
const currentLanguageCodeEl = document.querySelector("#current-language-code");
const languageOptionEls = Array.from(document.querySelectorAll("[data-language]"));
const siteTabEls = Array.from(document.querySelectorAll("[data-tab]"));
const sitePanelEls = Array.from(document.querySelectorAll("[data-panel]"));
const aboutExampleEls = Array.from(document.querySelectorAll("[data-about-example]"));
let activePronunciationButton = null;
let activePronunciationAudio = null;
let activePronunciationUtterance = null;
let typewriterTimerId = null;
let resultsRevealTimerId = null;
let resultsSwapTimerId = null;

const TYPEWRITER_EXAMPLE_COUNT = 40;
const TYPEWRITER_HANJA_SOURCE_NAME_COUNT = 72;
const TYPEWRITER_HANJA_VARIANTS_PER_NAME = 3;
const TYPEWRITER_HANJA_SURNAME_LIMIT = 200;
const TYPEWRITER_HANJA_SURNAME_MIN_PERCENT = 1;
const TYPEWRITER_POOL_LIMITS = { hangul: 96, roman: 96, kana: 96, hanja: 144 };
const TYPEWRITER_TYPE_DELAY_MS = 72;
const TYPEWRITER_DELETE_DELAY_MS = 42;
const TYPEWRITER_HOLD_DELAY_MS = 1280;
const LEGACY_GIVEN_NAME_PERIODS = new Set(["1970", "1980", "1990", "2004"]);
const LEGACY_GIVEN_NAME_SAMPLE_SHARE = 0.34;
const LEGACY_HANJA_SOURCE_SHARE = 0.36;

function t(key, params = {}) {
  const fallback = TRANSLATIONS.en[key];
  const value = TRANSLATIONS[state.language]?.[key] ?? fallback ?? key;
  return typeof value === "function" ? value(params) : value;
}

function formatNumber(value) {
  return new Intl.NumberFormat(LANGUAGE_CONFIG[state.language]?.intlLocale || "en").format(Number(value || 0));
}

function formatPercentRatio(count, total) {
  const value = total > 0 ? (Number(count || 0) / Number(total)) * 100 : 0;
  const requiresThreeDecimals = value > 0 && value < 0.01;
  return new Intl.NumberFormat(LANGUAGE_CONFIG[state.language]?.intlLocale || "en", {
    maximumFractionDigits: requiresThreeDecimals ? 3 : 2,
    minimumFractionDigits: requiresThreeDecimals ? 3 : 0,
  }).format(value);
}

function applyTranslations() {
  document.documentElement.lang = LANGUAGE_CONFIG[state.language]?.htmlLang || "en";
  document.documentElement.dataset.language = state.language;
  const roots = [document, resultTemplate?.content].filter(Boolean);
  for (const root of roots) {
    root.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
    });
    root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
    });
  }
  updateTypewriterActionLabel();
}

function updateTypewriterActionLabel() {
  if (!typewriterNameEl) return;
  const name = typewriterNameEl.dataset.searchValue || typewriterNameEl.textContent?.trim();
  if (name) typewriterNameEl.setAttribute("aria-label", t("typewriterSearchAria", { name }));
}

function updateLanguageSelector() {
  if (currentLanguageCodeEl) {
    currentLanguageCodeEl.textContent = LANGUAGE_CONFIG[state.language]?.code || "EN";
  }
  for (const option of languageOptionEls) {
    if (option.dataset.language === state.language) {
      option.setAttribute("aria-current", "true");
      option.setAttribute("aria-checked", "true");
    } else {
      option.removeAttribute("aria-current");
      option.setAttribute("aria-checked", "false");
    }
  }
}

function setLanguageMenuOpen(open, focusSelected = false) {
  if (!languageMenuEl || !languageTriggerEl) return;
  languageMenuEl.hidden = !open;
  languageTriggerEl.setAttribute("aria-expanded", String(open));
  if (!open || !focusSelected) return;
  const selected = languageOptionEls.find((option) => option.dataset.language === state.language);
  selected?.focus();
}

function setLanguage(language, options = {}) {
  const nextLanguage = LANGUAGE_CONFIG[language] ? language : normalizeLanguage(language);
  const { persist = true, rerender = true } = options;
  state.language = nextLanguage;
  if (persist) {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {
      // The selected language still applies for the current visit.
    }
  }
  applyTranslations();
  updateLanguageSelector();
  renderSearchHistory();
  setLanguageMenuOpen(false);
  if (rerender && state.runtime && queryEl?.value.trim()) {
    stopActivePronunciation();
    search(queryEl.value);
  }
}

function moveLanguageMenuFocus(direction) {
  if (!languageOptionEls.length) return;
  const activeIndex = languageOptionEls.indexOf(document.activeElement);
  const selectedIndex = languageOptionEls.findIndex((option) => option.dataset.language === state.language);
  const startIndex = activeIndex >= 0 ? activeIndex : Math.max(0, selectedIndex);
  const nextIndex = (startIndex + direction + languageOptionEls.length) % languageOptionEls.length;
  languageOptionEls[nextIndex].focus();
}

function setActiveSiteTab(name, options = {}) {
  const { focus = false } = options;
  const activeTab = siteTabEls.find((tab) => tab.dataset.tab === name) || siteTabEls[0];
  if (!activeTab) return;
  for (const tab of siteTabEls) {
    const selected = tab === activeTab;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  for (const panel of sitePanelEls) {
    panel.hidden = panel.dataset.panel !== activeTab.dataset.tab;
  }
  if (activeTab.dataset.tab !== "home") stopActivePronunciation();
  if (focus) activeTab.focus();
}

function moveSiteTabFocus(currentTab, direction) {
  const currentIndex = siteTabEls.indexOf(currentTab);
  if (currentIndex < 0 || !siteTabEls.length) return;
  const nextIndex = (currentIndex + direction + siteTabEls.length) % siteTabEls.length;
  setActiveSiteTab(siteTabEls[nextIndex].dataset.tab, { focus: true });
}

const compoundSurnamesFallback = new Set(["남궁", "황보", "선우", "제갈", "사공", "서문", "독고", "동방", "어금", "망절"]);
const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const HANGUL_ONSETS = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const HANGUL_VOWELS = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
const HANGUL_CODAS = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const COMPLEX_CODAS = new Set(["ㄳ", "ㄵ", "ㄶ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅄ"]);
const KANA_CODA_CARRIER_MAP = new Map([
  ["ム", new Set(["ㅁ"])],
  ["ン", new Set(["ㄴ", "ㅇ"])],
  ["ク", new Set(["ㄱ"])],
  ["プ", new Set(["ㅂ"])],
  ["ル", new Set(["ㄹ"])],
]);

function stripDiacritics(text) {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeLatin(text) {
  return stripDiacritics(text).toLowerCase().replace(/[^a-z]/g, "");
}

const MODERN_KOREAN_SURNAME_ROMAN_ALLOWLIST = new Map(Object.entries({
  김: ["kim", "gim"],
  이: ["lee", "yi", "i", "rhee"],
  박: ["park", "bak", "pak"],
  최: ["choi", "choe"],
  정: ["jung", "jeong", "chung"],
  조: ["cho", "jo", "joh"],
  강: ["kang", "gang"],
  윤: ["yoon", "yun"],
  장: ["jang", "chang"],
  임: ["im", "yim", "lim"],
  한: ["han", "hahn"],
  오: ["oh", "o"],
  서: ["seo", "so", "suh"],
  신: ["shin", "sin"],
  권: ["kwon", "gwon", "kweon"],
  황: ["hwang"],
  안: ["ahn", "an"],
  송: ["song"],
  전: ["jeon", "jun", "chun", "cheon"],
  홍: ["hong"],
  유: ["yoo", "yu", "you", "ryu", "ryoo", "lyu"],
  류: ["ryu", "ryoo", "yoo", "you", "lyu", "yu"],
  노: ["noh", "no", "roh", "ro", "rho"],
  차: ["cha"],
  후: ["hu"],
  흥: ["heung"],
}).map(([hangul, variants]) => [hangul, new Set(variants)]));

const BLOCKED_SURNAME_ROMAN_BY_HANGUL = new Map(Object.entries({
  간: ["khan"],
  고: ["gho"],
  후: ["hong", "hoo", "hou", "huu", "who"],
  흥: ["hong", "huynh", "khuong", "hung"],
  홍: ["heong", "heung", "hohng", "houng", "whong"],
  황: ["hang", "hoang", "huang", "hyang"],
  안: ["anh"],
  장: ["zhang", "zang"],
  방: ["phan"],
  판: ["phan"],
  권: ["guan"],
  한: ["hwan", "khan"],
}).map(([hangul, variants]) => [hangul, new Set(variants)]));

const MODERN_GIVEN_SYLLABLE_ROMAN_OUTPUT_ALLOWLIST = new Map(Object.entries({
  도: ["do"],
  언: ["eon"],
  헌: ["hun", "heon"],
  후: ["hu"],
  홍: ["hong"],
  흥: ["heung"],
}).map(([hangul, variants]) => [hangul, new Set(variants)]));

const EXPLICIT_H_SYLLABLE_BOUNDARY_PENALTY = 520;

const BLOCKED_GIVEN_ROMAN_BY_HANGUL = new Map(Object.entries({
  태: ["t"],
}).map(([hangul, variants]) => [hangul, new Set(variants)]));

const RARE_SURNAME_ROMAN_ALIASES = new Map(Object.entries({
  가: [{ text: "Kah", score: 6, inputScore: 60 }, { text: "Gah", score: 6, inputScore: 60 }],
  강: [{ text: "Kahng", score: 6, inputScore: 90 }],
  경: [{ text: "Kyeong", score: 6, inputScore: 70 }, { text: "Kyong", score: 6, inputScore: 70 }],
  곽: [{ text: "Kwack", score: 6, inputScore: 70 }, { text: "Gwag", score: 6, inputScore: 60 }],
  공: [{ text: "Kohng", score: 6, inputScore: 70 }, { text: "Koung", score: 6, inputScore: 60 }, { text: "Goung", score: 6, inputScore: 60 }],
  금: [{ text: "Guem", score: 6, inputScore: 70 }, { text: "Kuem", score: 6, inputScore: 70 }],
  기: [{ text: "Khee", score: 6, inputScore: 60 }],
  김: [{ text: "Kym", score: 6, inputScore: 90 }],
  남: [{ text: "Nahm", score: 6, inputScore: 80 }],
  남궁: [{ text: "Namkoung", score: 6, inputScore: 70 }],
  노: [{ text: "Nho", score: 6, inputScore: 70 }],
  도: [{ text: "Dho", score: 6, inputScore: 60 }],
  동: [{ text: "Dhong", score: 6, inputScore: 60 }],
  마: [{ text: "Mah", score: 6, inputScore: 60 }, { text: "Mha", score: 6, inputScore: 50 }],
  명: [{ text: "Myong", score: 6, inputScore: 70 }],
  모: [{ text: "Moh", score: 6, inputScore: 60 }, { text: "Mho", score: 6, inputScore: 50 }],
  문: [{ text: "Muhn", score: 6, inputScore: 80 }, { text: "Mhun", score: 6, inputScore: 80 }],
  민: [{ text: "Mihn", score: 6, inputScore: 70 }, { text: "Mhin", score: 6, inputScore: 80 }, { text: "Meen", score: 6, inputScore: 60 }],
  박: [{ text: "Bhak", score: 6, inputScore: 90 }, { text: "Phak", score: 6, inputScore: 80 }],
  반: [{ text: "Bahn", score: 6, inputScore: 70 }, { text: "Bhan", score: 6, inputScore: 60 }],
  방: [{ text: "Bahng", score: 6, inputScore: 70 }, { text: "Bhang", score: 6, inputScore: 70 }, { text: "Phang", score: 6, inputScore: 60 }],
  배: [{ text: "Pae", score: 6, inputScore: 80 }],
  백: [{ text: "Paek", score: 6, inputScore: 90 }, { text: "Bhak", score: 6, inputScore: 70 }, { text: "Phak", score: 6, inputScore: 60 }],
  변: [
    { text: "Byon", score: 6, inputScore: 80 },
    { text: "Pyun", score: 6, inputScore: 160 },
    { text: "Byoun", score: 6, inputScore: 70 },
    { text: "Pyon", score: 6, inputScore: 150 },
  ],
  봉: [{ text: "Bhong", score: 6, inputScore: 60 }, { text: "Pohng", score: 6, inputScore: 60 }],
  빈: [{ text: "Bhin", score: 6, inputScore: 60 }],
  선: [{ text: "Suhn", score: 6, inputScore: 70 }],
  설: [{ text: "Seul", score: 6, inputScore: 70 }],
  석: [{ text: "Sok", score: 6, inputScore: 70 }, { text: "Seuk", score: 6, inputScore: 60 }, { text: "Seak", score: 6, inputScore: 60 }],
  손: [{ text: "Shon", score: 6, inputScore: 80 }, { text: "Soun", score: 6, inputScore: 60 }],
  송: [{ text: "Soung", score: 6, inputScore: 70 }, { text: "Shong", score: 6, inputScore: 70 }],
  신: [{ text: "Shinn", score: 6, inputScore: 80 }, { text: "Sheen", score: 6, inputScore: 80 }],
  심: [{ text: "Seem", score: 6, inputScore: 70 }, { text: "Sheem", score: 6, inputScore: 70 }, { text: "Sihm", score: 6, inputScore: 70 }],
  엄: [{ text: "Uhm", score: 6, inputScore: 80 }],
  어: [{ text: "Eoh", score: 6, inputScore: 60 }],
  예: [{ text: "Yeh", score: 6, inputScore: 60 }],
  옥: [{ text: "Ohk", score: 6, inputScore: 60 }],
  원: [{ text: "Weon", score: 6, inputScore: 70 }],
  윤: [{ text: "Yune", score: 6, inputScore: 70 }, { text: "Yeun", score: 6, inputScore: 70 }],
  인: [{ text: "Ihn", score: 6, inputScore: 60 }],
  전: [{ text: "Chon", score: 6, inputScore: 80 }, { text: "Jeun", score: 6, inputScore: 70 }],
  정: [{ text: "Joung", score: 6, inputScore: 80 }, { text: "Chong", score: 6, inputScore: 180 }, { text: "Cheong", score: 6, inputScore: 70 }],
  채: [{ text: "Chea", score: 6, inputScore: 70 }],
  차: [{ text: "Chah", score: 6, inputScore: 70 }],
  탁: [{ text: "Tark", score: 6, inputScore: 60 }],
  편: [{ text: "Pyon", score: 6, inputScore: 70 }, { text: "Pyoun", score: 6, inputScore: 60 }, { text: "Pyeun", score: 6, inputScore: 60 }],
  하: [{ text: "Hah", score: 6, inputScore: 70 }],
  한: [{ text: "Hann", score: 6, inputScore: 80 }],
  현: [{ text: "Hyon", score: 6, inputScore: 80 }, { text: "Hyoun", score: 6, inputScore: 70 }],
  황: [{ text: "Whang", score: 6, inputScore: 90 }],
  궉: [{ text: "Kuck", score: 6, inputScore: 120 }],
  지: [{ text: "Gee", score: 6, inputScore: 40 }],
  장: [{ text: "Jahng", score: 6, inputScore: 90 }, { text: "Jhang", score: 6, inputScore: 70 }],
}));

const RARE_GIVEN_ROMAN_ALIASES = new Map(Object.entries({
  병: [{ text: "byong", score: 8 }, { text: "byoung", score: 7 }],
  용: [{ text: "yueng", score: 8 }],
  연: [{ text: "ion", score: 6 }],
  채: [{ text: "chea", score: 8 }],
  혜: [{ text: "hae", score: 8 }, { text: "hea", score: 8 }, { text: "hey", score: 7 }],
  원: [{ text: "one", score: 6 }],
  준: [{ text: "june", score: 8 }],
  지: [{ text: "gee", score: 7 }],
  백: [{ text: "back", score: 5 }],
  학: [{ text: "hack", score: 5 }],
  록: [{ text: "rock", score: 5 }],
  길: [{ text: "gill", score: 5 }],
  만: [{ text: "mann", score: 5 }],
  민: [{ text: "mhin", score: 6 }],
  필: [{ text: "phil", score: 5 }],
}));

const LEGACY_UCK_ROMAN_VOWELS = new Set(["ㅓ", "ㅕ"]);

const INITIAL_SOUND_LAW_SURNAME_PAIRS = new Set([
  "나|라",
  "노|로",
  "누|루",
  "이|리",
  "여|려",
  "요|료",
  "유|류",
  "양|량",
  "염|렴",
  "임|림",
]);

const ATTESTED_GIVEN_NAME_ROMAN_ALIASES = new Map();

const ATTESTED_CHRISTIAN_GIVEN_KANA = new Map(Object.entries({
  다윗: [
    { text: "ダウィ", score: 360 },
    { text: "ダウィッ", score: 280 },
  ],
}));

function isModernRomanText(text) {
  return /^[A-Za-z][A-Za-z -]*$/.test(text || "");
}

function modernGivenRomanVariantsForOutput(syllable, variants) {
  const modernVariants = (variants || []).filter((item) => isModernRomanText(item.text));
  const allowlist = MODERN_GIVEN_SYLLABLE_ROMAN_OUTPUT_ALLOWLIST.get(syllable);
  if (allowlist) {
    const filtered = modernVariants.filter((item) => allowlist.has(normalizeLatin(item.text)));
    if (filtered.length) return filtered;
  }
  const blocklist = BLOCKED_GIVEN_ROMAN_BY_HANGUL.get(syllable);
  const filtered = modernVariants.filter((item) => {
    const norm = normalizeLatin(item.text);
    if (!norm) return false;
    if (blocklist?.has(norm)) return false;
    if (!hasRomanVowel(norm)) return false;
    return !/(?:uh|aeu)/.test(norm);
  });
  return filtered.length ? filtered : modernVariants;
}

function isModernKoreanSurnameRomanVariant(hangul, item, index = 0) {
  const text = item?.text || "";
  if (!isModernRomanText(text)) return false;
  const norm = normalizeLatin(text);
  if (!norm) return false;
  if (BLOCKED_SURNAME_ROMAN_BY_HANGUL.get(hangul)?.has(norm)) return false;
  if (MODERN_KOREAN_SURNAME_ROMAN_ALLOWLIST.get(hangul)?.has(norm)) return true;
  const score = Number(item?.score || 0);
  return score >= 5.5 || (index === 0 && score >= 4.5);
}

function isUnsupportedComplexCodaInData(syllable, data) {
  const parts = decomposeHangulSyllable(syllable);
  if (!parts?.coda || !COMPLEX_CODAS.has(parts.coda)) return false;
  return !data?.syllables?.[syllable]?.sinoAllowed;
}

function hasIndexNameEvidence(syllable, data) {
  const item = data?.syllables?.[syllable];
  if (!item || isUnsupportedComplexCodaInData(syllable, data)) return false;
  return (
    Number(item.nameCount || 0) > 0 ||
    Number(item.givenCount || 0) > 0 ||
    Number(item.initialCount || 0) > 0 ||
    Number(item.surnamePopulation || 0) > 0 ||
    Number(item.hanjaGivenCount || 0) > 0 ||
    Number(item.decadeWeight || 0) > 0 ||
    Number(item.decadePeriods || 0) > 0 ||
    item.sinoAllowed === true ||
    item.nonSinoException === true
  );
}

function hasGivenNameEvidenceInData(syllable, data) {
  const item = data?.syllables?.[syllable];
  if (!item || isUnsupportedComplexCodaInData(syllable, data)) return false;
  return (
    Number(item.givenCount || 0) > 0 ||
    Number(item.hanjaGivenCount || 0) > 0 ||
    Number(item.decadeWeight || 0) > 0 ||
    Number(item.decadePeriods || 0) > 0 ||
    item.sinoAllowed === true ||
    item.nonSinoException === true
  );
}

function sanitizeModernNameEvidenceData(data) {
  if (!data?.syllables) return data;
  const supportedSyllables = new Set(
    Object.entries(data.syllables)
      .filter(([syllable]) => hasIndexNameEvidence(syllable, data))
      .map(([syllable]) => syllable),
  );
  const filterSyllableItems = (items) => (items || []).filter((item) => supportedSyllables.has(item.hangul));
  const filterIndex = (index) => {
    const filtered = {};
    for (const [key, items] of Object.entries(index || {})) {
      const kept = filterSyllableItems(items);
      if (kept.length) filtered[key] = kept;
    }
    return filtered;
  };

  data.syllables = Object.fromEntries(
    Object.entries(data.syllables).filter(([syllable]) => supportedSyllables.has(syllable)),
  );
  data.syllableLatinIndex = filterIndex(data.syllableLatinIndex);
  data.syllableKanaIndex = filterIndex(data.syllableKanaIndex);
  data.hanjaGivenIndex = filterIndex(data.hanjaGivenIndex);
  if (data.meta) data.meta.syllableCount = supportedSyllables.size;
  return data;
}

function rebuildSyllableLatinIndex(data) {
  const index = {};
  for (const [hangul, syllable] of Object.entries(data?.syllables || {})) {
    for (const item of syllable.latin || []) {
      const norm = normalizeLatin(item.text);
      if (!norm) continue;
      const bucket = index[norm] || [];
      bucket.push({ hangul, score: Number(item.score) || 0 });
      index[norm] = bucket;
    }
  }

  for (const key of Object.keys(index)) {
    index[key].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  }

  data.syllableLatinIndex = index;
}

function attachRareSurnameRomanAliases(data) {
  for (const [hangul, aliases] of RARE_SURNAME_ROMAN_ALIASES) {
    const surname = (data?.surnames || []).find((item) => item.hangul === hangul);
    if (!surname) continue;

    const latin = surname.latin || [];
    const existing = new Set(latin.map((item) => normalizeLatin(item.text)).filter(Boolean));
    for (const alias of aliases) {
      const normalized = normalizeLatin(alias.text);
      if (!normalized || existing.has(normalized)) continue;
      const score = Number(alias.score) || 0;
      latin.push({ text: alias.text, score });
      existing.add(normalized);

      const bucket = data.surnameLatinIndex?.[normalized] || [];
      if (!bucket.some((item) => item.hangul === hangul)) {
        bucket.push({ hangul, score: Number(alias.inputScore) || score });
      }
      if (data.surnameLatinIndex) data.surnameLatinIndex[normalized] = bucket;
    }
    surname.latin = latin.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  }
}

function attachRareGivenRomanAliases(data) {
  for (const [hangul, aliases] of RARE_GIVEN_ROMAN_ALIASES) {
    const syllable = data?.syllables?.[hangul];
    if (!syllable) continue;

    const latin = syllable.latin || [];
    const existing = new Set(latin.map((item) => normalizeLatin(item.text)).filter(Boolean));
    for (const alias of aliases) {
      const normalized = normalizeLatin(alias.text);
      if (!normalized || existing.has(normalized)) continue;
      latin.push({ text: alias.text, score: Number(alias.score) || 0 });
      existing.add(normalized);
    }
    syllable.latin = latin.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  }
}

function attachLegacyUckRomanAliases(data) {
  for (const [hangul, syllable] of Object.entries(data?.syllables || {})) {
    if (!hasGivenNameEvidenceInData(hangul, data)) continue;
    const parts = decomposeHangulSyllable(hangul);
    if (!parts || parts.coda !== "ㄱ" || !LEGACY_UCK_ROMAN_VOWELS.has(parts.vowel)) continue;

    const latin = syllable.latin || [];
    const existing = new Set(latin.map((item) => normalizeLatin(item.text)).filter(Boolean));
    const sourceVariants = latin.filter((item) => {
      const normalized = normalizeLatin(item.text);
      return normalized.endsWith("eok") && Number(item.score || 0) >= 5;
    });

    for (const source of sourceVariants) {
      const normalized = normalizeLatin(source.text);
      const alias = `${normalized.slice(0, -3)}uck`;
      if (!alias || existing.has(alias)) continue;
      const score = Math.max(6, Math.min(12, Number(source.score || 0) * 0.45));
      latin.push({ text: alias, score });
      existing.add(alias);
    }
    syllable.latin = latin.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  }
}

function attachAttestedGivenNameRomanAliases(data) {
  if (!data) return;
  data.supplementalGivenRomanIndex ||= {};
  for (const [given, aliases] of ATTESTED_GIVEN_NAME_ROMAN_ALIASES) {
    for (const alias of aliases) {
      const normalized = normalizeLatin(alias.text);
      if (!normalized) continue;
      const bucket = data.supplementalGivenRomanIndex[normalized] || [];
      if (!bucket.some((item) => item.given === given)) {
        bucket.push({ given, score: Number(alias.searchScore) || 0 });
      }
      data.supplementalGivenRomanIndex[normalized] = bucket;
    }
  }
}

function surnameSpellingsAreInitialSoundLawVariants(first, second) {
  if (!first || !second || first === second) return false;
  return INITIAL_SOUND_LAW_SURNAME_PAIRS.has(`${first}|${second}`) || INITIAL_SOUND_LAW_SURNAME_PAIRS.has(`${second}|${first}`);
}

function surnameEntryPercent(count, population) {
  const denominator = Number(population || 0);
  if (!denominator) return null;
  return Number(((Number(count || 0) / denominator) * 100).toFixed(2));
}

function sortSurnameHanjaEntries(entries) {
  return (entries || []).sort(
    (a, b) =>
      Number(b.count || 0) - Number(a.count || 0) ||
      Number(b.percent || 0) - Number(a.percent || 0) ||
      String(a.text || "").localeCompare(String(b.text || "")),
  );
}

function rebuildSurnameHanjaIndex(data) {
  const index = {};
  const add = (hanja, hangul, score) => {
    if (!hanja || !hangul) return;
    const bucket = index[hanja] || [];
    const existing = bucket.find((item) => item.hangul === hangul);
    if (existing) existing.score = Math.max(Number(existing.score || 0), Number(score || 0));
    else bucket.push({ hangul, score: Number(score || 0) });
    index[hanja] = bucket;
  };

  for (const surname of data?.surnames || []) {
    const score = Math.log1p(Number(surname.population || 0) || 1);
    for (const entry of surname.hanjaEntries || []) {
      add(entry.text, surname.hangul, score);
    }
    for (const entry of surname.hanjaCompatibilityEntries || []) {
      add(entry.text, surname.hangul, score * 0.92);
    }
  }

  for (const bucket of Object.values(index)) {
    bucket.sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || a.hangul.localeCompare(b.hangul));
  }
  data.surnameHanjaIndex = index;
}

function attachBonGwanSurnameHanjaData(data, bonGwanData) {
  if (!data || !bonGwanData?.surnames) return data;
  const surnameByHangul = new Map((data.surnames || []).map((item) => [item.hangul, item]));

  for (const [key, record] of Object.entries(bonGwanData.surnames || {})) {
    const [hangul, hanja] = key.split("|");
    if (!hangul || !hanja || hanja === "?") continue;
    const surname = surnameByHangul.get(hangul);
    if (!surname) continue;

    surname.hanjaEntries ||= [];
    const count = Number(record?.total || 0);
    const existing = surname.hanjaEntries.find((item) => item.text === hanja);
    if (existing) {
      if (count > Number(existing.count || 0)) existing.count = count;
      if (existing.percent == null) existing.percent = surnameEntryPercent(existing.count, surname.population);
    } else {
      surname.hanjaEntries.push({
        text: hanja,
        count,
        percent: surnameEntryPercent(count, surname.population),
      });
    }
    surname.hanja = Array.from(new Set([...(surname.hanja || []), hanja]));
    sortSurnameHanjaEntries(surname.hanjaEntries);
  }

  return data;
}

function attachInitialSoundLawSurnameHanjaAliases(data, bonGwanData) {
  if (!data || !bonGwanData?.surnames || !data.hanjaReadingIndex) return data;
  const surnameByHangul = new Map((data.surnames || []).map((item) => [item.hangul, item]));

  for (const [sourceKey, record] of Object.entries(bonGwanData.surnames || {})) {
    const [sourceHangul, hanja] = sourceKey.split("|");
    if (!sourceHangul || !hanja || hanja === "?") continue;
    const readings = data.hanjaReadingIndex[hanja] || [];
    for (const targetHangul of readings) {
      if (!surnameSpellingsAreInitialSoundLawVariants(sourceHangul, targetHangul)) continue;
      if (bonGwanData.surnames[`${targetHangul}|${hanja}`]) continue;
      const targetSurname = surnameByHangul.get(targetHangul);
      if (!targetSurname) continue;
      if ((targetSurname.hanjaEntries || []).some((item) => item.text === hanja)) continue;

      targetSurname.hanjaCompatibilityEntries ||= [];
      if (targetSurname.hanjaCompatibilityEntries.some((item) => item.text === hanja && item.sourceKey === sourceKey)) continue;
      targetSurname.hanjaCompatibilityEntries.push({
        text: hanja,
        count: Number(record?.total || 0),
        score: Math.log1p(Number(record?.total || 0) || 1),
        sourceKey,
        sourceHangul,
      });
      targetSurname.hanja = Array.from(new Set([...(targetSurname.hanja || []), hanja]));
    }
  }

  return data;
}

function sanitizeModernKoreanRomanData(data) {
  if (!data) return data;
  attachRareSurnameRomanAliases(data);
  attachRareGivenRomanAliases(data);
  attachLegacyUckRomanAliases(data);
  attachAttestedGivenNameRomanAliases(data);
  const allowedSurnameRomanByHangul = new Map();

  data.surnames = (data.surnames || []).map((surname) => {
    const filteredLatin = (surname.latin || []).filter((item, index) =>
      isModernKoreanSurnameRomanVariant(surname.hangul, item, index),
    );
    const fallbackLatin = filteredLatin.length
      ? filteredLatin
      : (surname.latin || []).filter((item) => isModernRomanText(item.text)).slice(0, 1);
    allowedSurnameRomanByHangul.set(
      surname.hangul,
      new Set(fallbackLatin.map((item) => normalizeLatin(item.text)).filter(Boolean)),
    );
    return { ...surname, latin: fallbackLatin };
  });

  if (data.surnameLatinIndex) {
    const filteredIndex = {};
    for (const [key, items] of Object.entries(data.surnameLatinIndex)) {
      const norm = normalizeLatin(key);
      const kept = (items || []).filter((item) => allowedSurnameRomanByHangul.get(item.hangul)?.has(norm));
      if (kept.length) filteredIndex[norm] = kept;
    }
    data.surnameLatinIndex = filteredIndex;
  }

  data.fullNames = (data.fullNames || []).map((row) => ({
    ...row,
    romanizations: (row.romanizations || []).filter((item) => isModernRomanText(item.text)),
  }));

  if (data.fullNameRomanIndex) {
    const filteredIndex = {};
    for (const [index, row] of (data.fullNames || []).entries()) {
      for (const item of row.romanizations || []) {
        const norm = normalizeLatin(item.text);
        if (!norm) continue;
        const bucket = filteredIndex[norm] || [];
        bucket.push({ index: String(index), score: Number(item.score) || 0 });
        filteredIndex[norm] = bucket;
      }
    }
    data.fullNameRomanIndex = filteredIndex;
  }

  for (const [syllable, meta] of Object.entries(data.syllables || {})) {
    const filteredLatin = modernGivenRomanVariantsForOutput(syllable, meta.latin || []);
    meta.latin = filteredLatin.length ? filteredLatin : (meta.latin || []).filter((item) => isModernRomanText(item.text));
  }
  rebuildSyllableLatinIndex(data);

  return sanitizeModernNameEvidenceData(data);
}

function attachHanjaReadingData(data, hanjaReadingData) {
  const readings = hanjaReadingData?.readings;
  if (!data || !readings || typeof readings !== "object") return data;
  data.hanjaReadingIndex = readings;
  if (data.meta && hanjaReadingData.meta) {
    data.meta.hanjaReadingSource = hanjaReadingData.meta.source || "Unihan";
    data.meta.hanjaReadingField = hanjaReadingData.meta.field || "kHangul";
    data.meta.hanjaReadingCount = Number(hanjaReadingData.meta.readingCount || 0);
  }
  return data;
}

function attachHanjaNameCharData(data, hanjaNameCharData) {
  const byReading = hanjaNameCharData?.charactersByReading;
  if (!data || !byReading || typeof byReading !== "object") return data;
  data.hanjaNameCharsByReading = byReading;
  if (data.meta && hanjaNameCharData.meta) {
    data.meta.hanjaNameCharSource = hanjaNameCharData.meta.source || "Unihan kHangul";
    data.meta.hanjaNameCharCount = Number(hanjaNameCharData.meta.characterCount || 0);
  }
  return data;
}

function attachHanjaUsageRankData(data, hanjaUsageRankData) {
  if (!data || !hanjaUsageRankData) return data;
  data.hanjaUsageGivenNames = hanjaUsageRankData.givenNames || {};
  data.hanjaUsageCharsByReading = hanjaUsageRankData.charactersByReading || {};
  if (data.meta && hanjaUsageRankData.meta) {
    data.meta.hanjaUsageRankSource = hanjaUsageRankData.meta.source || "Modern baby-name Hanja usage prior";
    data.meta.hanjaUsageRankCharacterReadingCount = Number(hanjaUsageRankData.meta.characterReadingCount || 0);
  }
  return data;
}

async function fetchOptionalJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function normalizeKana(text) {
  return Array.from(text)
    .map((char) => {
      const code = char.codePointAt(0);
      if (code >= 0x3041 && code <= 0x3096) {
        return String.fromCodePoint(code + 0x60);
      }
      if (/[ 　・･\-\u2010-\u2015]/.test(char)) {
        return "";
      }
      return char;
    })
    .join("");
}

const BLOCKED_JAPANESE_KANA_SURFACES = ["ウンチ"];

function isBlockedJapaneseKanaSurface(text) {
  const norm = normalizeKana(text || "");
  if (!norm) return false;
  return BLOCKED_JAPANESE_KANA_SURFACES.some((surface) => norm.includes(surface));
}

function extractHangul(text) {
  return (text.match(/[가-힣]/g) || []).join("");
}

function extractHanja(text) {
  return (text.match(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g) || []).join("");
}

function detectScripts(text) {
  const labels = [];
  if ((text.match(scriptPatterns.hangul) || []).length) labels.push("Hangul");
  if ((text.match(scriptPatterns.latin) || []).length) labels.push("Roman");
  if ((text.match(scriptPatterns.kana) || []).length) labels.push("Kana");
  if ((text.match(scriptPatterns.hanja) || []).length) labels.push("Hanja");
  return labels;
}

function configuredTtsEndpoint() {
  if (typeof window === "undefined") return "";
  const endpoint = window.KOREAN_NAME_TTS_ENDPOINT;
  return typeof endpoint === "string" ? endpoint.trim() : "";
}

function supportsSpeechSynthesis() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function supportsAudioPlayback() {
  return typeof Audio !== "undefined";
}

function isLikelyMobileBrowser() {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const userAgent = navigator.userAgent || "";
  const touchCapable = Number(navigator.maxTouchPoints || 0) > 0;
  const coarsePointer = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent) || (touchCapable && coarsePointer);
}

function koreanSpeechVoice() {
  if (!supportsSpeechSynthesis()) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => /^ko(?:[-_]|$)/i.test(voice.lang || "")) ||
    voices.find((voice) => /korean|한국|yuna|sora/i.test(`${voice.name || ""} ${voice.lang || ""}`)) ||
    null
  );
}

function setPronunciationButtonState(button, state) {
  if (!button) return;
  button.dataset.state = state;
  button.disabled = state === "loading";
}

function resetPronunciationButton(button) {
  if (!button) return;
  button.dataset.state = "idle";
  button.disabled = false;
}

function hasActiveSpeechSynthesisQueue() {
  if (!supportsSpeechSynthesis()) return false;
  const speechSynthesis = window.speechSynthesis;
  return Boolean(activePronunciationUtterance || speechSynthesis.speaking || speechSynthesis.pending);
}

function stopActivePronunciation() {
  if (activePronunciationAudio) {
    activePronunciationAudio.pause();
    activePronunciationAudio.removeAttribute("src");
    activePronunciationAudio.load();
    activePronunciationAudio = null;
  }
  if (hasActiveSpeechSynthesisQueue()) {
    window.speechSynthesis.cancel();
  }
  if (activePronunciationButton) {
    resetPronunciationButton(activePronunciationButton);
  }
  activePronunciationButton = null;
  activePronunciationUtterance = null;
}

function ttsEndpointUrl(endpoint, text) {
  const url = new URL(endpoint, window.location.href);
  url.searchParams.set("text", text);
  url.searchParams.set("lang", "ko");
  return url.toString();
}

function naverTtsAudioUrl(text) {
  const url = new URL("https://dict.naver.com/api/nvoice");
  url.searchParams.set("service", "dictionary");
  url.searchParams.set("speech_fmt", "mp3");
  url.searchParams.set("text", text);
  url.searchParams.set("speaker", "kyuri");
  url.searchParams.set("speed", "0");
  return url.toString();
}

function ttsAudioCandidates(text) {
  const endpoint = configuredTtsEndpoint();
  return [
    endpoint ? ttsEndpointUrl(endpoint, text) : "",
    naverTtsAudioUrl(text),
  ].filter(Boolean);
}

function playTtsAudioUrl(url) {
  return new Promise((resolve, reject) => {
    if (!supportsAudioPlayback()) {
      reject(new Error("Audio playback unavailable"));
      return;
    }
    const audio = new Audio(url);
    let finished = false;
    let started = false;
    const startTimeout = window.setTimeout(() => {
      if (started || finished) return;
      finished = true;
      audio.pause();
      reject(new Error("TTS audio did not start"));
    }, 2500);
    const finish = (callback) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(startTimeout);
      callback();
    };
    const markStarted = () => {
      started = true;
      window.clearTimeout(startTimeout);
    };
    activePronunciationAudio = audio;
    audio.addEventListener("playing", markStarted, { once: true });
    audio.addEventListener("ended", () => finish(resolve), { once: true });
    audio.addEventListener("error", () => finish(() => reject(new Error("TTS audio failed"))), { once: true });
    audio.play().then(markStarted).catch((error) => finish(() => reject(error)));
  });
}

function estimatedSpeechDurationMs(text) {
  const syllableCount = Array.from(text || "").length;
  return Math.min(4200, Math.max(1400, 800 + syllableCount * 260));
}

function playSpeechSynthesisPronunciation(text, button, options = {}) {
  return new Promise((resolve, reject) => {
    if (!supportsSpeechSynthesis()) {
      reject(new Error("Speech synthesis unavailable"));
      return;
    }

    const { cancelExisting = true } = options;
    if (cancelExisting && hasActiveSpeechSynthesisQueue()) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = koreanSpeechVoice();
    let settled = false;
    const fallbackEndTimeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve();
    }, estimatedSpeechDurationMs(text));
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallbackEndTimeout);
      callback();
    };

    utterance.lang = "ko-KR";
    utterance.rate = 0.88;
    utterance.pitch = 1;
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      setPronunciationButtonState(button, "playing");
    };
    utterance.onend = () => finish(resolve);
    utterance.onerror = (event) => finish(() => reject(event.error || new Error("Speech synthesis failed")));
    activePronunciationUtterance = utterance;
    setPronunciationButtonState(button, "playing");
    window.speechSynthesis.speak(utterance);
    if (typeof window.speechSynthesis.resume === "function") {
      window.speechSynthesis.resume();
    }
  });
}

async function playKoreanPronunciation(text, button) {
  if (!text) return;
  if (button === activePronunciationButton && button.dataset.state === "playing") {
    stopActivePronunciation();
    return;
  }

  stopActivePronunciation();
  activePronunciationButton = button;
  const shouldUseMobileSpeechFirst = isLikelyMobileBrowser() && supportsSpeechSynthesis();

  if (shouldUseMobileSpeechFirst) {
    try {
      await playSpeechSynthesisPronunciation(text, button, { cancelExisting: false });
      resetPronunciationButton(button);
      activePronunciationButton = null;
      activePronunciationUtterance = null;
      return;
    } catch {
      activePronunciationUtterance = null;
      setPronunciationButtonState(button, "loading");
    }
  } else {
    setPronunciationButtonState(button, "loading");
  }

  for (const audioUrl of ttsAudioCandidates(text)) {
    try {
      setPronunciationButtonState(button, "playing");
      await playTtsAudioUrl(audioUrl);
      activePronunciationAudio = null;
      resetPronunciationButton(button);
      activePronunciationButton = null;
      return;
    } catch {
      activePronunciationAudio = null;
      setPronunciationButtonState(button, "loading");
    }
  }

  if (!supportsSpeechSynthesis() || isLikelyMobileBrowser()) {
    button.disabled = true;
    button.dataset.state = "unavailable";
    activePronunciationButton = null;
    return;
  }

  try {
    await playSpeechSynthesisPronunciation(text, button);
    resetPronunciationButton(button);
    activePronunciationButton = null;
    activePronunciationUtterance = null;
  } catch {
    button.disabled = true;
    button.dataset.state = "unavailable";
    activePronunciationButton = null;
    activePronunciationUtterance = null;
  }
}

function romanTextToTokenish(text) {
  return stripDiacritics(text)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[._,/()[\]{}（）]+/g, " ")
    .replace(/[‐‑‒–—―]+/g, "-");
}

function hasUnsupportedRomanPunctuation(text) {
  const raw = String(text || "");
  if (raw.includes("\\")) return true;
  const value = romanTextToTokenish(raw).toLowerCase();
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "'") continue;
    const before = value.slice(0, index);
    const after = value.slice(index + 1);
    if (!/(?:ch|ts|[ptk])$/.test(before) || !/^[aeiou]/.test(after)) return true;
  }
  return false;
}

function splitRomanGroups(text) {
  return romanTextToTokenish(text)
    .split(/\s+/)
    .map((group) => (group.match(/[A-Za-z]+/g) || []).map((token) => token.toLowerCase()).filter(Boolean))
    .filter((group) => group.length);
}

function hasRomanHyphenBoundary(text) {
  return /[A-Za-z]-+[A-Za-z]/.test(romanTextToTokenish(text));
}

function splitRomanTokens(text) {
  return splitRomanGroups(text).flat();
}

function isLeeSurnameCue(token) {
  return normalizeLatin(token) === "lee";
}

function forcedRomanHangulCandidates(token) {
  const norm = normalizeLatin(token);
  if (!norm) return null;
  if (norm === "joong") {
    return [{ hangul: "중", score: 100000 }];
  }
  if (norm === "yon") {
    return [{ hangul: "연", score: 100000 }];
  }
  return null;
}

function hasRomanVowel(text) {
  return /[aeiouy]/.test(text);
}

function expandRomanTokenVariants(token) {
  const norm = normalizeLatin(token);
  if (!norm) return [];
  const variants = [{ token: norm, penalty: 0 }];
  const replacements = [
    ["kyoung", "kyung", 6],
    ["kyeng", "kyung", 2],
    ["hayon", "hayeon", 2],
    ["jeoun", "jeon", 5],
    ["guen", "gyun", 3],
    ["kwi", "gwi", 2],
    ["heun", "heon", 2],
    ["yeu", "yu", 3],
    ["yeoun", "yeon", 5],
    ["ryeon", "yeon", 180],
    ["ryun", "yun", 180],
    ["lyeon", "yeon", 180],
    ["lyun", "yun", 180],
    ["yea", "ye", 5],
    ["yae", "ye", 2],
    ["sunghyun", "sunghyeon", 2],
    ["junghyun", "junghyeon", 2],
    ["june", "jun", 2],
    ["joon", "jun", 2],
    ["choon", "chun", 2],
    ["aeh", "ae", 2],
  ];
  for (const [from, to, penalty] of replacements) {
    if (norm.includes(from)) {
      variants.push({ token: norm.replaceAll(from, to), penalty });
    }
  }
  if (norm === "ion") {
    variants.push({ token: "yeon", penalty: 5 });
  }
  if (/^eu(?:l|r)?i/.test(norm)) {
    variants.push({
      token: norm.replace(/^eu/, "yu"),
      penalty: 3,
    });
  }
  if (/[aeiouy]ll(?=[bcdfghjklmnpqrstvwxyz]|$)/.test(norm)) {
    variants.push({
      token: norm.replace(/([aeiouy])ll(?=[bcdfghjklmnpqrstvwxyz]|$)/g, "$1l"),
      penalty: 2,
    });
  }
  if (/[aeiouy]c(?=[bcdfghjklmnpqrstvwxyz]|$)/.test(norm)) {
    variants.push({
      token: norm.replace(/([aeiouy])c(?=[bcdfghjklmnpqrstvwxyz]|$)/g, "$1k"),
      penalty: 2,
    });
  }
  if (norm.includes("v")) {
    variants.push({
      token: norm.replaceAll("v", "b"),
      penalty: 3,
    });
  }
  if (/[aeiou]h(?=[bcdfghjklmnpqrstvwxyz]|$)/.test(norm)) {
    // Keep recovery for misspellings, but do not discard an explicit next-syllable h almost for free.
    const hasExplicitHBoundary = /[aeiou]h(?=(?:[aeiou]|[yw][aeiou]))/.test(norm);
    variants.push({
      token: norm.replace(/([aeiou])h(?=[bcdfghjklmnpqrstvwxyz]|$)/g, "$1"),
      penalty: hasExplicitHBoundary ? EXPLICIT_H_SYLLABLE_BOUNDARY_PENALTY : 4,
    });
  }
  return dedupeScoredByField(variants, "token", "score", 8).map((item) => ({
    token: item.token,
    penalty: variants.find((variant) => variant.token === item.token)?.penalty || 0,
  }));
}

function splitKanaTokens(text) {
  return text
    .replace(/[・･]/g, " ")
    .split(/[\s\u3000\-]+/)
    .map((token) => normalizeKana(token))
    .filter(Boolean);
}

function splitKanaSpaceGroups(text) {
  return (text || "")
    .split(/[\s\u3000]+/)
    .map((token) => normalizeKana(token))
    .filter(Boolean);
}

function tokenizeByScript(text) {
  const groups = [];
  let current = "";
  let currentType = null;
  for (const char of Array.from(text)) {
    let type = null;
    if (/[가-힣]/.test(char)) type = "hangul";
    else if (/[A-Za-zÀ-ȳŏŭŎŬ]/.test(char)) type = "latin";
    else if (/[ァ-ヶー゛゜ぁ-ゖゝゞ]/.test(char)) type = "kana";
    else if (/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(char)) type = "hanja";
    else type = "sep";

    if (type === "sep") {
      if (current) groups.push({ type: currentType, text: current });
      current = "";
      currentType = null;
      continue;
    }
    if (type === currentType) {
      current += char;
    } else {
      if (current) groups.push({ type: currentType, text: current });
      current = char;
      currentType = type;
    }
  }
  if (current) groups.push({ type: currentType, text: current });
  return groups;
}

function splitNameUnits(name, compoundSurnames) {
  const compounds = compoundSurnames || compoundSurnamesFallback;
  const surnameLength = name.length >= 3 && compounds.has(name.slice(0, 2)) ? 2 : 1;
  return {
    surname: name.slice(0, surnameLength),
    given: name.slice(surnameLength),
    units: Array.from(name.slice(0, surnameLength)).concat(Array.from(name.slice(surnameLength))),
  };
}

function analyzeQueryMeta(query) {
  const groups = tokenizeByScript(query);
  const romanGroups = splitRomanGroups(query);
  const romanTokens = romanGroups.flat();
  const singleRomanToken = groups.length === 1 && groups[0]?.type === "latin" && romanGroups.length === 1 && romanTokens.length === 1;
  const normalizedSingleRoman = singleRomanToken ? normalizeLatin(romanTokens[0]) : "";
  return {
    isSingleRomanToken: singleRomanToken,
    explicitMedialRomanLateralCue: !!normalizedSingleRoman && /[a-z][rl]y(?:a|e|o|u|i)/.test(normalizedSingleRoman),
  };
}

function candidateKey(hangul, kind = "full") {
  return `${kind}:${hangul}`;
}

function candidateKindLabel(kind) {
  if (kind === "surname") return t("kindSurname");
  if (kind === "given") return t("kindGiven");
  return t("kindFull");
}

function candidateRoleKinds(candidate) {
  if (candidate?.roleKinds instanceof Set && candidate.roleKinds.size) return candidate.roleKinds;
  return new Set([candidate?.kind || "full"]);
}

function candidateGivenUnits(candidate) {
  if (candidate.kind === "given") return Array.from(candidate.hangul);
  if (candidate.kind === "surname") return [];
  return Array.from(splitNameUnits(candidate.hangul, state.runtime?.compoundSurnames).given);
}

function isLikelyFullNameMisparsedAsGiven(candidate, candidateMap) {
  if (!candidate || candidate.kind !== "given") return false;
  const units = Array.from(candidate.hangul || "");
  if (units.length < 3 || units.length > 4) return false;
  // An indexed whole given name is stronger evidence than a coincidental rare-surname split.
  if (hasSupportedWholeGivenName(units)) return false;
  const { surname, given } = splitNameUnits(candidate.hangul, state.runtime?.compoundSurnames);
  if (!surname || !given) return false;
  if (!state.runtime?.surnameByHangul?.has(surname)) return false;
  const givenUnits = Array.from(given);
  const supportedGiven =
    hasSupportedWholeGivenName(givenUnits) ||
    givenUnits.every((syllable) => hasGivenSyllableEvidence(syllable) || isSinoLikeGivenSyllable(syllable));
  if (!supportedGiven) return false;
  if (!candidateMap) return true;
  return candidateMap.has(candidateKey(candidate.hangul, "full"));
}

function candidateRankingScore(candidate) {
  let score = Number(candidate?.score);
  if (!Number.isFinite(score)) score = 0;
  const evidenceList = candidate?.evidence ? [...candidate.evidence] : [];
  if (
    candidate?.kind === "full" &&
    evidenceList.some((item) => /Supplemental attested Roman query match|Exact Romanized name match/.test(item))
  ) {
    score += 180;
  }
  if (candidate?.kind === "full") {
    const { surname } = splitNameUnits(candidate.hangul, state.runtime?.compoundSurnames);
    score += surnamePopulationPrior(surname);
  }
  const units = candidateGivenUnits(candidate);
  if (candidate?.kind !== "surname" && units.length) {
    if (hasSupportedWholeGivenName(units)) {
      score += 900 + Math.min(1600, givenWholeNamePrior(units) * 0.4) + givenWholeNameRankingBoost(units);
    } else if (units.length >= 2) {
      score -= unsupportedWholeGivenPenalty(units);
      if (units.some((syllable) => isUltraRareGivenSyllable(syllable))) {
        score -= 360;
      }
    }
  }
  const liveNormalizedQuery = normalizeLatin(queryEl?.value || "");
  const explicitMedialRomanLateralCue =
    state.queryMeta?.explicitMedialRomanLateralCue ||
    (!!liveNormalizedQuery && /[a-z][rl]y(?:a|e|o|u|i)/.test(liveNormalizedQuery));
  if (explicitMedialRomanLateralCue && candidate?.kind === "given" && units.length === 2) {
    const secondParts = decomposeHangulSyllable(units[1]);
    if (secondParts && DUUM_RECOVERY_VOWELS.has(secondParts.vowel)) {
      if (secondParts.onset === "ㄹ" && isPlausibleRecoveredDuumSyllable(units[1])) score += 100000;
      else if (secondParts.onset === "ㅇ") score -= 100000;
    }
  }
  return Number.isFinite(score) ? score : 0;
}

function decomposeHangulSyllable(syllable) {
  if (!syllable || syllable.length !== 1) return null;
  const code = syllable.codePointAt(0);
  if (code < HANGUL_BASE || code > HANGUL_END) return null;
  const offset = code - HANGUL_BASE;
  const onset = HANGUL_ONSETS[Math.floor(offset / 588)];
  const vowel = HANGUL_VOWELS[Math.floor((offset % 588) / 28)];
  const coda = HANGUL_CODAS[offset % 28];
  return { onset, vowel, coda };
}

function requiredPlainOnsetForVoicedKana(text) {
  const norm = normalizeKana(text || "");
  const mapping = [
    ["ジャ", "ㅈ"], ["ジュ", "ㅈ"], ["ジョ", "ㅈ"], ["ジェ", "ㅈ"], ["ジ", "ㅈ"],
    ["ヂャ", "ㄷ"], ["ヂュ", "ㄷ"], ["ヂョ", "ㄷ"], ["ヂェ", "ㄷ"], ["ヂ", "ㄷ"],
    ["ガ", "ㄱ"], ["ギ", "ㄱ"], ["グ", "ㄱ"], ["ゲ", "ㄱ"], ["ゴ", "ㄱ"],
    ["ダ", "ㄷ"], ["デ", "ㄷ"], ["ド", "ㄷ"],
    ["バ", "ㅂ"], ["ビ", "ㅂ"], ["ブ", "ㅂ"], ["ベ", "ㅂ"], ["ボ", "ㅂ"],
  ];
  for (const [prefix, onset] of mapping) {
    if (norm.startsWith(prefix)) return onset;
  }
  return null;
}

function filterKanaChunkCandidates(chunk, items) {
  if (!items?.length) return [];
  const requiredOnset = requiredPlainOnsetForVoicedKana(chunk);
  if (!requiredOnset) return items;
  const filtered = items.filter((item) => decomposeHangulSyllable(item.hangul)?.onset === requiredOnset);
  return filtered.length ? filtered : items;
}

function syntheticKanaCandidateScore(hangul, scale = 1) {
  const syllableData = state.data?.syllables?.[hangul];
  if (!syllableData) return 0;
  const observed = Number(syllableData.givenCount || 0) + Number(syllableData.nameCount || 0);
  const decadeWeight = Number(syllableData.decadeWeight || 0);
  const hanjaGivenCount = Number(syllableData.hanjaGivenCount || 0);
  let score = Math.log1p(observed) * 8 + Math.log1p(decadeWeight) * 5 + Math.log1p(hanjaGivenCount) * 10;
  if (isAllowedNameSyllable(hangul)) score += 12;
  if (isUltraRareGivenSyllable(hangul)) score -= 18;
  return Math.max(1.2, score * scale);
}

function syntheticSurnameKanaCandidateScore(hangul, scale = 1) {
  const surnameData = state.runtime?.surnameByHangul?.get(hangul);
  if (!surnameData) return 0;
  const population = Number(surnameData.population || 0);
  return Math.max(1.2, Math.log1p(population) * 14 * scale);
}

function mergeKanaCandidateLists(primary, synthetic, targetField = "hangul", limit = 12) {
  return dedupeScoredByField([...(primary || []), ...(synthetic || [])], targetField, "score", limit);
}

function isBlockedUnsupportedComplexCodaSyllable(syllable) {
  return isUnsupportedComplexCodaInData(syllable, state.data);
}

function kanaSyllableAliases(chunk) {
  const norm = normalizeKana(chunk);
  const aliases = [];
  const voicedGiyeok = voiceInitialGiyeokKana(norm);
  if (voicedGiyeok && voicedGiyeok !== norm) {
    const voicedMatches = state.data.syllableKanaIndex?.[voicedGiyeok] || [];
    for (const item of voicedMatches) {
      if (decomposeHangulSyllable(item.hangul)?.onset !== "ㄱ") continue;
      aliases.push({
        hangul: item.hangul,
        score: Number(item.score || 0) * 0.64,
      });
    }
  }
  if (norm === "ガン") {
    aliases.push(
      { hangul: "광", score: syntheticKanaCandidateScore("광", 0.88) },
      { hangul: "관", score: syntheticKanaCandidateScore("관", 0.82) },
    );
  }
  if (norm === "コン" || norm === "ゴン") {
    aliases.push({ hangul: "권", score: syntheticKanaCandidateScore("권", norm === "ゴン" ? 0.92 : 0.84) });
  }
  return aliases.filter((item) => item.score > 0);
}

function kanaSurnameAliases(token) {
  const norm = normalizeKana(token);
  const aliases = [];
  if (norm === "コン" || norm === "ゴン") {
    aliases.push({ hangul: "권", score: syntheticSurnameKanaCandidateScore("권", norm === "ゴン" ? 0.96 : 0.88) });
  }
  return aliases.filter((item) => item.score > 0);
}

function isDuumShiftedSurfaceSyllable(syllable) {
  const parts = decomposeHangulSyllable(syllable);
  return !!parts && canRecoverDuumShiftedInitial(parts);
}

function lookupKanaChunkCandidates(chunk) {
  const exact = filterKanaChunkCandidates(chunk, state.data.syllableKanaIndex[normalizeKana(chunk)] || []);
  const aliased = filterKanaChunkCandidates(chunk, kanaSyllableAliases(chunk));
  const merged = mergeKanaCandidateLists(exact, aliased, "hangul", 12);
  const filtered = merged.filter((item) => !isBlockedUnsupportedComplexCodaSyllable(item.hangul));
  const pool = filtered.length ? filtered : merged;
  const evidenceBacked = pool.filter((item) => hasGivenSyllableEvidence(item.hangul) || isAllowedNameSyllable(item.hangul));
  if (evidenceBacked.length) return evidenceBacked;
  if (pool.length && isDuumShiftedSurfaceSyllable(pool[0].hangul)) {
    return [pool[0]];
  }
  return pool;
}

function applyNieunLiaison(nextKana) {
  const text = normalizeKana(nextKana);
  const mapping = [
    ["ヒャ", "ニャ"],
    ["ヒュ", "ニュ"],
    ["ヒョ", "ニョ"],
    ["ヒェ", "ニェ"],
    ["ファ", "ナ"],
    ["フィ", "ニ"],
    ["フェ", "ネ"],
    ["フォ", "ノ"],
    ["ハ", "ナ"],
    ["ヒ", "ニ"],
    ["フ", "ヌ"],
    ["ヘ", "ネ"],
    ["ホ", "ノ"],
    ["イェ", "ニェ"],
    ["ヤ", "ニャ"],
    ["ユ", "ニュ"],
    ["ヨ", "ニョ"],
    ["ア", "ナ"],
    ["イ", "ニ"],
    ["ウ", "ヌ"],
    ["エ", "ネ"],
    ["オ", "ノ"],
  ];
  for (const [from, to] of mapping) {
    if (text.startsWith(from)) {
      return `${to}${text.slice(from.length)}`;
    }
  }
  return null;
}

function applyRieulLiaison(nextKana) {
  const text = normalizeKana(nextKana);
  const mapping = [
    ["ヒャ", "リャ"],
    ["ヒュ", "リュ"],
    ["ヒョ", "リョ"],
    ["ヒェ", "リェ"],
    ["ファ", "ラ"],
    ["フィ", "リ"],
    ["フェ", "レ"],
    ["フォ", "ロ"],
    ["ハ", "ラ"],
    ["ヒ", "リ"],
    ["フ", "ル"],
    ["ヘ", "レ"],
    ["ホ", "ロ"],
    ["イェ", "リェ"],
    ["ヤ", "リャ"],
    ["ユ", "リュ"],
    ["ヨ", "リョ"],
    ["ア", "ラ"],
    ["イ", "リ"],
    ["ウ", "ル"],
    ["エ", "レ"],
    ["オ", "ロ"],
  ];
  for (const [from, to] of mapping) {
    if (text.startsWith(from)) {
      return `${to}${text.slice(from.length)}`;
    }
  }
  return null;
}

function applyGiyeokLiaison(nextKana) {
  const text = normalizeKana(nextKana);
  const mapping = [
    ["イェ", "ギェ"],
    ["ヤ", "ギャ"],
    ["ユ", "ギュ"],
    ["ヨ", "ギョ"],
    ["ア", "ガ"],
    ["イ", "ギ"],
    ["ウ", "グ"],
    ["エ", "ゲ"],
    ["オ", "ゴ"],
  ];
  for (const [from, to] of mapping) {
    if (text.startsWith(from)) return `${to}${text.slice(from.length)}`;
  }
  return null;
}

function applyMieumLiaison(nextKana) {
  const text = normalizeKana(nextKana);
  const mapping = [
    ["イェ", "ミェ"],
    ["ヤ", "ミャ"],
    ["ユ", "ミュ"],
    ["ヨ", "ミョ"],
    ["ア", "マ"],
    ["イ", "ミ"],
    ["ウ", "ム"],
    ["エ", "メ"],
    ["オ", "モ"],
  ];
  for (const [from, to] of mapping) {
    if (text.startsWith(from)) return `${to}${text.slice(from.length)}`;
  }
  return null;
}

function applyBieupLiaison(nextKana) {
  const text = normalizeKana(nextKana);
  const mapping = [
    ["イェ", "ビェ"],
    ["ヤ", "ビャ"],
    ["ユ", "ビュ"],
    ["ヨ", "ビョ"],
    ["ア", "バ"],
    ["イ", "ビ"],
    ["ウ", "ブ"],
    ["エ", "ベ"],
    ["オ", "ボ"],
  ];
  for (const [from, to] of mapping) {
    if (text.startsWith(from)) return `${to}${text.slice(from.length)}`;
  }
  return null;
}

function codaLiaisonRule(coda) {
  if (coda === "ㄱ") return { carrier: "ク", apply: applyGiyeokLiaison, scoreScale: 1.06 };
  if (coda === "ㄴ") return { carrier: "ン", apply: applyNieunLiaison, scoreScale: 1.08 };
  if (coda === "ㄹ") return { carrier: "ル", apply: applyRieulLiaison, scoreScale: 0.9 };
  if (coda === "ㅁ") return { carrier: "ム", apply: applyMieumLiaison, scoreScale: 1.06 };
  if (coda === "ㅂ") return { carrier: "プ", apply: applyBieupLiaison, scoreScale: 1.06 };
  return null;
}

const REVERSE_NIEUN_LIAISON_PREFIXES = [
  ["ニャ", ["ヤ", "ヒャ"]],
  ["ニュ", ["ユ", "ヒュ"]],
  ["ニョ", ["ヨ", "ヒョ"]],
  ["ニェ", ["イェ", "ヒェ"]],
  ["ナ", ["ア", "ハ", "ファ"]],
  ["ニ", ["イ", "ヒ", "フィ"]],
  ["ヌ", ["ウ", "フ"]],
  ["ネ", ["エ", "ヘ", "フェ"]],
  ["ノ", ["オ", "ホ", "フォ"]],
];

const REVERSE_RIEUL_LIAISON_PREFIXES = [
  ["リャ", ["ヤ", "ヒャ"]],
  ["リュ", ["ユ", "ヒュ"]],
  ["リョ", ["ヨ", "ヒョ"]],
  ["リェ", ["イェ", "ヒェ"]],
  ["ラ", ["ア", "ハ", "ファ"]],
  ["リ", ["イ", "ヒ", "フィ"]],
  ["ル", ["ウ", "フ"]],
  ["レ", ["エ", "ヘ", "フェ"]],
  ["ロ", ["オ", "ホ", "フォ"]],
];

function reverseNieunLiaisonSurfaces(text) {
  const norm = normalizeKana(text);
  const surfaces = [];
  for (const [from, originals] of REVERSE_NIEUN_LIAISON_PREFIXES) {
    if (!norm.startsWith(from)) continue;
    for (const original of originals) {
      surfaces.push(`${original}${norm.slice(from.length)}`);
    }
  }
  return surfaces;
}

function reverseRieulLiaisonSurfaces(text) {
  const norm = normalizeKana(text);
  const surfaces = [];
  for (const [from, originals] of REVERSE_RIEUL_LIAISON_PREFIXES) {
    if (!norm.startsWith(from)) continue;
    for (const original of originals) {
      surfaces.push(`${original}${norm.slice(from.length)}`);
    }
  }
  return surfaces;
}

function generateLiaisonKanaVariants(parts, syllables) {
  let surfaces = [{ text: parts.join("\u0000"), scoreScale: 1 }];
  for (let index = 1; index < parts.length; index += 1) {
    const previous = decomposeHangulSyllable(syllables[index - 1]);
    const current = decomposeHangulSyllable(syllables[index]);
    if (!previous || !current) continue;
    const rule = codaLiaisonRule(previous.coda);
    if (!rule) continue;
    const supportsCurrentOnset = current.onset === "ㅇ" || (current.onset === "ㅎ" && ["ㄴ", "ㄹ"].includes(previous.coda));
    if (!supportsCurrentOnset) continue;

    const nextSurface = [];
    for (const surface of surfaces) {
      nextSurface.push(surface);
      const currentParts = surface.text ? surface.text.split("\u0000") : parts.slice();
      const previousPart = currentParts[index - 1] || "";
      const currentPart = currentParts[index] || "";
      if (!previousPart.endsWith(rule.carrier)) continue;
      const liaison = rule.apply(currentPart);
      if (!liaison) continue;
      const mergedParts = currentParts.slice();
      mergedParts[index - 1] = previousPart.slice(0, -1);
      mergedParts[index] = liaison;
      nextSurface.push({
        text: mergedParts.join("\u0000"),
        scoreScale: surface.scoreScale * rule.scoreScale,
      });
    }
    surfaces = dedupeScoredByField(
      nextSurface.map((item) => ({ surface: item.text, score: item.scoreScale })),
      "surface",
      "score",
      12,
    ).map((item) => ({ text: item.surface, scoreScale: item.score }));
  }

  return surfaces.map((item) => ({
    text: item.text.split("\u0000").join(""),
    scoreScale: item.scoreScale,
  }));
}

function normalizeKanaPartForSyllable(part, syllable, hasFollowingPart = true) {
  if (!part) return part;
  if (hasFollowingPart && part.endsWith("ング")) return `${part.slice(0, -2)}ン`;
  const decomposed = decomposeHangulSyllable(syllable);
  if (decomposed?.coda === "ㅇ" && part.endsWith("グ")) return `${part.slice(0, -1)}ン`;
  return part;
}

function normalizeKanaPartsForJoin(parts, syllables = []) {
  return parts.map((part, index) => normalizeKanaPartForSyllable(part, syllables[index], index < parts.length - 1));
}

function normalizeKanaJoinPart(part, syllable, hasFollowingPart = true) {
  return normalizeKanaPartForSyllable(part, syllable, hasFollowingPart);
}

function unvoiceInitialGiyeokKana(text) {
  if (!text) return text;
  const replacements = [
    ["ギャ", "キャ"],
    ["ギュ", "キュ"],
    ["ギョ", "キョ"],
    ["ギェ", "キェ"],
    ["グァ", "クァ"],
    ["グェ", "クェ"],
    ["グィ", "クィ"],
    ["グォ", "クォ"],
    ["ガ", "カ"],
    ["ギ", "キ"],
    ["グ", "ク"],
    ["ゲ", "ケ"],
    ["ゴ", "コ"],
  ];
  for (const [from, to] of replacements) {
    if (text.startsWith(from)) return `${to}${text.slice(from.length)}`;
  }
  return text;
}

function voiceInitialGiyeokKana(text) {
  if (!text) return text;
  const replacements = [
    ["キャ", "ギャ"],
    ["キュ", "ギュ"],
    ["キョ", "ギョ"],
    ["キェ", "ギェ"],
    ["クァ", "グァ"],
    ["クェ", "グェ"],
    ["クィ", "グィ"],
    ["クォ", "グォ"],
    ["カ", "ガ"],
    ["キ", "ギ"],
    ["ク", "グ"],
    ["ケ", "ゲ"],
    ["コ", "ゴ"],
  ];
  for (const [from, to] of replacements) {
    if (text.startsWith(from)) return `${to}${text.slice(from.length)}`;
  }
  return text;
}

function unvoiceInitialBieupKana(text) {
  if (!text) return text;
  const replacements = [
    ["ビャ", "ピャ"],
    ["ビュ", "ピュ"],
    ["ビョ", "ピョ"],
    ["ビェ", "ピェ"],
    ["バ", "パ"],
    ["ビ", "ピ"],
    ["ブ", "プ"],
    ["ベ", "ペ"],
    ["ボ", "ポ"],
  ];
  for (const [from, to] of replacements) {
    if (text.startsWith(from)) return `${to}${text.slice(from.length)}`;
  }
  return text;
}

function augmentInitialGivenKanaVariants(syllable, variants, syllableIndex) {
  if (syllableIndex !== 0 || !variants?.length) return variants || [];
  const parts = decomposeHangulSyllable(syllable);
  if (!parts || parts.onset !== "ㄱ") return variants;
  const augmented = [...variants];
  for (const variant of variants) {
    const unvoiced = unvoiceInitialGiyeokKana(variant.text);
    if (!unvoiced || unvoiced === variant.text) continue;
    if (augmented.some((item) => item.text === unvoiced)) continue;
    augmented.push({
      text: unvoiced,
      score: Number(variant.score) * 0.62,
    });
  }
  return augmented.sort((a, b) => Number(b.score) - Number(a.score));
}

function applySokuonGeminateBoundary(previousPart, currentPart, coda, onset) {
  if (!previousPart || !currentPart) return null;
  if (coda === "ㄱ" && onset === "ㄱ" && previousPart.endsWith("ク")) {
    const unvoiced = unvoiceInitialGiyeokKana(currentPart);
    if (!unvoiced || unvoiced === currentPart) return null;
    return [`${previousPart.slice(0, -1)}ッ`, unvoiced];
  }
  if (coda === "ㅂ" && onset === "ㅂ" && previousPart.endsWith("プ")) {
    const unvoiced = unvoiceInitialBieupKana(currentPart);
    if (!unvoiced || unvoiced === currentPart) return null;
    return [`${previousPart.slice(0, -1)}ッ`, unvoiced];
  }
  return null;
}

function generateSokuonGeminateKanaVariants(parts, units) {
  let surfaces = [{ parts: parts.slice(), scoreScale: 1 }];
  for (let index = 1; index < units.length; index += 1) {
    const next = [];
    for (const surface of surfaces) {
      next.push(surface);
      const previous = decomposeHangulSyllable(units[index - 1]);
      const current = decomposeHangulSyllable(units[index]);
      if (!previous || !current) continue;
      const transformed = applySokuonGeminateBoundary(
        surface.parts[index - 1],
        surface.parts[index],
        previous.coda,
        current.onset,
      );
      if (!transformed) continue;
      const nextParts = surface.parts.slice();
      nextParts[index - 1] = transformed[0];
      nextParts[index] = transformed[1];
      next.push({
        parts: nextParts,
        scoreScale: surface.scoreScale * 1.14,
      });
    }
    surfaces = dedupeScoredByField(
      next.map((item) => ({ surface: item.parts.join("\u0000"), score: item.scoreScale })),
      "surface",
      "score",
      12,
    ).map((item) => ({ parts: item.surface.split("\u0000"), scoreScale: item.score }));
  }
  return surfaces.filter((item) => item.parts.join("") !== parts.join(""));
}

function dedupeScored(items, textKey = "text", scoreKey = "score", limit = 8) {
  const map = new Map();
  for (const item of items) {
    const key = item[textKey];
    const score = Number(item[scoreKey]) || 0;
    map.set(key, Math.max(score, map.get(key) || 0));
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([text, score]) => ({ text, score }));
}

function dedupeScoredByField(items, fieldKey, scoreKey = "score", limit = 8) {
  const map = new Map();
  for (const item of items) {
    const key = item[fieldKey];
    if (key == null) continue;
    const score = Number(item[scoreKey]) || 0;
    map.set(key, Math.max(score, map.get(key) || 0));
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, score]) => ({ [fieldKey]: value, score }));
}

function dedupeCandidateUnits(candidates, limit = 24) {
  const map = new Map();
  for (const candidate of candidates) {
    const key = (candidate.units || []).join("");
    if (!key) continue;
    const existing = map.get(key);
    if (!existing || Number(candidate.score) > Number(existing.score)) {
      map.set(key, candidate);
    }
  }
  return [...map.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function givenRomanContextScore(syllable, romanText, score) {
  const parts = decomposeHangulSyllable(syllable);
  const norm = normalizeLatin(romanText);
  let value = Number(score) || 0;
  if (!parts || !norm) return value;

  if (parts.onset === "ㅈ" && norm.startsWith("ch")) {
    value *= 0.08;
  } else if (parts.onset === "ㅊ" && norm.startsWith("ch")) {
    value = Math.max(value, 96);
  }

  return value;
}

function contextualGivenRomanCandidates(items, token) {
  if (!items?.length) return [];
  return items
    .map((item) => ({
      ...item,
      score: givenRomanContextScore(item.hangul, token, item.score),
    }))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
}

function pruneWeakExactSyllableMatches(items, token, threshold = 0.14) {
  if (!items?.length) return [];
  const topScore = Number(items[0].score) || 0;
  if (!topScore) return items;
  return items.filter((item, index) => {
    if (index === 0 || Number(item.score) >= topScore * threshold) return true;
    const syllable = state.data?.syllables?.[item.hangul];
    const latinVariants = (syllable?.latin || []).map((variant) => normalizeLatin(variant.text));
    if (!token || !latinVariants.includes(token)) return false;
    const total = Number(syllable?.givenCount || 0) + Number(syllable?.nameCount || 0);
    const ultraRare = total <= 2 && Number(syllable?.decadeWeight || 0) === 0;
    const unsupportedForNames = !syllable?.sinoAllowed && !Number(syllable?.hanjaGivenCount || 0);
    if (ultraRare && unsupportedForNames) return false;
    return true;
  });
}

function givenSyllableNamePrior(syllable) {
  const data = state.data?.syllables?.[syllable];
  if (!data) return -80;
  const total = Number(data.givenCount || 0) + Number(data.nameCount || 0);
  const decadeWeight = Number(data.decadeWeight || 0);
  const decadePeriods = Number(data.decadePeriods || 0);
  const allowlisted = isAllowedNameSyllable(syllable);
  if (total === 0 && decadeWeight === 0) return allowlisted ? -140 : -420;
  if (total <= 2 && decadeWeight === 0) return allowlisted ? -120 : -720;
  if (total <= 4 && decadeWeight === 0) return allowlisted ? -40 : -260;
  let prior = Math.log1p(Math.max(total, 0)) * 12 + Math.log1p(Math.max(decadeWeight, 0)) * 5 + decadePeriods * 10;
  if (total <= 2) prior -= 180;
  else if (total <= 4) prior -= 70;
  return prior;
}

function givenWholeNamePrior(units) {
  const name = units.join("");
  if (!name) return 0;
  const data = state.data?.givenNames?.[name];
  if (!data) return 0;
  const totalWeight = Number(data.totalWeight || 0);
  const periodsPresentCount = Number(data.periodsPresentCount || 0);
  const datasetCount = Number(data.datasetCount || 0);
  const rowOccurrences = Number(data.rowOccurrences || 0);
  let prior = 0;
  if (totalWeight > 0) {
    prior += Math.log1p(totalWeight) * 18;
    prior += periodsPresentCount * 20;
  }
  if (datasetCount > 0) prior += Math.log1p(datasetCount) * 35;
  if (rowOccurrences > 0) prior += Math.log1p(rowOccurrences) * 8;
  return prior;
}

function givenWholeNameRankingBoost(units) {
  const name = units.join("");
  if (!name) return 0;
  const data = state.data?.givenNames?.[name];
  if (!data) return 0;
  const totalWeight = Number(data.totalWeight || 0);
  const periodsPresentCount = Number(data.periodsPresentCount || 0);
  const datasetCount = Number(data.datasetCount || 0);
  const rowOccurrences = Number(data.rowOccurrences || 0);
  let boost = 0;
  if (totalWeight > 0) boost += Math.pow(Math.log1p(totalWeight), 2) * 10;
  if (periodsPresentCount > 0) boost += periodsPresentCount * 120;
  if (datasetCount > 0) boost += datasetCount * 260;
  if (rowOccurrences > 0) boost += rowOccurrences * 45;
  return boost;
}

function surnamePopulationPrior(hangul) {
  const surnameData = state.runtime?.surnameByHangul?.get(hangul);
  const population = Number(surnameData?.population || 0);
  if (!population) return -2200;

  let prior = Math.log1p(population) * 115;
  if (population < 50) prior -= 2600;
  else if (population < 200) prior -= 1850;
  else if (population < 1000) prior -= 1100;
  else if (population < 10000) prior -= 520;
  else if (population < 50000) prior -= 140;

  return prior;
}

function hasSupportedWholeGivenName(units) {
  const name = units.join("");
  if (!name) return false;
  const data = state.data?.givenNames?.[name];
  if (!data) return false;
  return Number(data.totalWeight || 0) > 0 || Number(data.datasetCount || 0) > 0 || Number(data.rowOccurrences || 0) > 0;
}

function constructedGivenSyllableEvidenceStrength(syllable) {
  const data = state.data?.syllables?.[syllable];
  if (!data) return 0;

  const total = Number(data.givenCount || 0) + Number(data.nameCount || 0);
  const decadeWeight = Number(data.decadeWeight || 0);
  const decadePeriods = Number(data.decadePeriods || 0);
  let strength = 0;

  if (isAllowedNameSyllable(syllable)) strength += 1.2;
  if (hasHanjaGivenSupport(syllable)) strength += 1.1;
  if (total > 0) strength += Math.min(2.4, Math.log1p(total) * 0.7);
  if (decadeWeight > 0) strength += Math.min(2.2, Math.log1p(decadeWeight) * 0.2 + decadePeriods * 0.2);

  return strength;
}

function unsupportedWholeGivenPenalty(units) {
  const basePenalty = 780;
  if (!units?.length) return basePenalty;

  const evidenceBacked = units.every((syllable) => hasGivenSyllableEvidence(syllable) || isSinoLikeGivenSyllable(syllable));
  if (!evidenceBacked) return basePenalty;

  const strengths = units.map((syllable) => constructedGivenSyllableEvidenceStrength(syllable));
  const weakest = Math.min(...strengths);
  const average = strengths.reduce((sum, value) => sum + value, 0) / strengths.length;
  const evidenceRelief = Math.min(600, average * 80 + weakest * 70);
  return Math.max(180, Math.round(basePenalty - evidenceRelief));
}

function givenUnitsNamePrior(units) {
  const extraUnitPenalty = units.length <= 2 ? 0 : (units.length - 2) * 80;
  const wholePrior = givenWholeNamePrior(units);
  const supportedWholeName = hasSupportedWholeGivenName(units);
  const syllablePrior = units.reduce((sum, syllable) => {
    const prior = givenSyllableNamePrior(syllable);
    return sum + (supportedWholeName ? Math.max(prior, -60) : prior);
  }, 0);
  return syllablePrior + wholePrior - extraUnitPenalty;
}

function hasGivenSyllableEvidence(syllable) {
  return hasGivenNameEvidenceInData(syllable, state.data);
}

function isUltraRareGivenSyllable(syllable) {
  const data = state.data?.syllables?.[syllable];
  if (!data) return true;
  const total = Number(data.givenCount || 0) + Number(data.nameCount || 0);
  const decadeWeight = Number(data.decadeWeight || 0);
  return total <= 2 && decadeWeight === 0;
}

function hasHanjaGivenSupport(syllable) {
  const data = state.data?.syllables?.[syllable];
  return Number(data?.hanjaGivenCount || 0) > 0;
}

function isSinoAllowedSyllable(syllable) {
  return !!state.data?.syllables?.[syllable]?.sinoAllowed;
}

function isNonSinoExceptionSyllable(syllable) {
  return !!state.data?.syllables?.[syllable]?.nonSinoException;
}

function isAllowedNameSyllable(syllable) {
  if (isBlockedUnsupportedComplexCodaSyllable(syllable)) return false;
  return isSinoAllowedSyllable(syllable) || isNonSinoExceptionSyllable(syllable);
}

function isNameLikeGivenSyllable(syllable) {
  return hasGivenNameEvidenceInData(syllable, state.data);
}

function isNameLikeGivenUnits(units) {
  if (!units?.length) return false;
  if (hasSupportedWholeGivenName(units)) return true;
  if (hasUnattestedNonSinoGivenCombination(units)) return false;
  return units.every((syllable) => isNameLikeGivenSyllable(syllable));
}

function isNameLikeCandidate(candidate) {
  if (!candidate?.hangul) return false;
  if (candidate.kind === "surname") {
    return !!state.runtime?.surnameByHangul?.has(candidate.hangul);
  }
  const units = candidateGivenUnits(candidate);
  if (!isNameLikeGivenUnits(units)) return false;
  if (candidate.kind === "given") return true;
  const { surname, given } = splitNameUnits(candidate.hangul, state.runtime?.compoundSurnames);
  return !!given && !!state.runtime?.surnameByHangul?.has(surname);
}

function hasCandidateExactEvidence(candidate) {
  return (
    (candidate?.exactIds && candidate.exactIds.size > 0) ||
    [...(candidate?.evidence || [])].some((item) => /Exact|Supplemental/.test(item))
  );
}

function isFullyAllowedGivenCandidate(candidate) {
  return candidate.units.every((syllable) => isAllowedNameSyllable(syllable));
}

function isSinoLikeGivenSyllable(syllable) {
  return isSinoAllowedSyllable(syllable) || hasHanjaGivenSupport(syllable) || isPlausibleRecoveredDuumSyllable(syllable);
}

function isSinoLikeRomanGivenCandidate(candidate) {
  return candidate.units.every((syllable) => isSinoLikeGivenSyllable(syllable));
}

function isSinoBackedGivenCandidate(candidate) {
  return candidate.units.every((syllable) => isSinoAllowedSyllable(syllable) || hasHanjaGivenSupport(syllable));
}

function hasUnattestedNonSinoGivenCombination(units) {
  return (
    units.length > 1 &&
    !hasSupportedWholeGivenName(units) &&
    units.some((syllable) => isNonSinoExceptionSyllable(syllable) && !isSinoAllowedSyllable(syllable))
  );
}

function filterEvidenceBackedGivenCandidates(candidates) {
  const filteredComplexCoda = candidates.filter(
    (candidate) => candidate.units.every((syllable) => !isBlockedUnsupportedComplexCodaSyllable(syllable)),
  );
  const pool = filteredComplexCoda.filter(
    (candidate) => !hasUnattestedNonSinoGivenCombination(candidate.units),
  );
  if (!pool.length) return [];
  const evidenceBacked = pool.filter((candidate) =>
    hasSupportedWholeGivenName(candidate.units) ||
    candidate.units.every((syllable) => hasGivenSyllableEvidence(syllable) || isSinoLikeGivenSyllable(syllable)),
  );
  return evidenceBacked.length ? evidenceBacked : pool;
}

function composeHangulSyllable(onset, vowel, coda = "") {
  const onsetIndex = HANGUL_ONSETS.indexOf(onset);
  const vowelIndex = HANGUL_VOWELS.indexOf(vowel);
  const codaIndex = HANGUL_CODAS.indexOf(coda);
  if (onsetIndex < 0 || vowelIndex < 0 || codaIndex < 0) return null;
  return String.fromCodePoint(HANGUL_BASE + onsetIndex * 588 + vowelIndex * 28 + codaIndex);
}

const DUUM_RECOVERY_VOWELS = new Set(["ㅑ", "ㅒ", "ㅕ", "ㅖ", "ㅛ", "ㅠ", "ㅣ"]);

function canRecoverDuumShiftedInitial(parts) {
  return parts?.onset === "ㄴ" && DUUM_RECOVERY_VOWELS.has(parts.vowel);
}

function recoveredOnsetOptionsForDuum(parts) {
  if (!canRecoverDuumShiftedInitial(parts)) return [];
  return ["ㅇ", "ㄹ"];
}

function recoveredCodaOptionsForNasalizedSurface(coda) {
  if (coda === "ㅇ") return ["ㄱ"];
  if (coda === "ㄴ") return ["ㄷ"];
  if (coda === "ㅁ") return ["ㅂ"];
  return [];
}

function isPlausibleRecoveredDuumSyllable(syllable) {
  const parts = decomposeHangulSyllable(syllable);
  if (!parts) return false;
  if (isBlockedUnsupportedComplexCodaSyllable(syllable)) return false;
  if (!["ㅇ", "ㄹ"].includes(parts.onset)) return false;
  if (!DUUM_RECOVERY_VOWELS.has(parts.vowel)) return false;
  if (isAllowedNameSyllable(syllable) || hasGivenSyllableEvidence(syllable) || hasHanjaGivenSupport(syllable)) {
    return true;
  }
  const recoveredSurface = composeHangulSyllable("ㄴ", parts.vowel, parts.coda);
  if (!recoveredSurface) return false;
  return (
    isAllowedNameSyllable(recoveredSurface) ||
    hasGivenSyllableEvidence(recoveredSurface) ||
    hasHanjaGivenSupport(recoveredSurface)
  );
}

function recoverPronouncedSinoGivenCandidates(candidates) {
  const recovered = [...(candidates || [])];
  for (const candidate of candidates || []) {
    const units = candidate.units || [];
    for (let index = 1; index < units.length; index += 1) {
      const previous = decomposeHangulSyllable(units[index - 1]);
      const current = decomposeHangulSyllable(units[index]);
      if (!previous || !current) continue;
      if (!canRecoverDuumShiftedInitial(current)) continue;

      const previousCodaOptions = recoveredCodaOptionsForNasalizedSurface(previous.coda);
      if (!previousCodaOptions.length) continue;

      for (const restoredPreviousCoda of previousCodaOptions) {
        const restoredPrevious = composeHangulSyllable(previous.onset, previous.vowel, restoredPreviousCoda);
        if (!restoredPrevious) continue;
        if (!isAllowedNameSyllable(restoredPrevious) && !hasGivenSyllableEvidence(restoredPrevious) && !hasHanjaGivenSupport(restoredPrevious)) {
          continue;
        }

        for (const restoredOnset of recoveredOnsetOptionsForDuum(current)) {
          const restoredCurrent = composeHangulSyllable(restoredOnset, current.vowel, current.coda);
          if (!restoredCurrent) continue;
          const currentPlausible =
            isAllowedNameSyllable(restoredCurrent) ||
            hasGivenSyllableEvidence(restoredCurrent) ||
            hasHanjaGivenSupport(restoredCurrent) ||
            isPlausibleRecoveredDuumSyllable(restoredCurrent);
          if (!currentPlausible) continue;

          const nextUnits = units.slice();
          nextUnits[index - 1] = restoredPrevious;
          nextUnits[index] = restoredCurrent;
          recovered.push({
            units: nextUnits,
            score: Number(candidate.score) * (restoredOnset === "ㅇ" ? 0.91 : 0.86) + 18,
            recovered: true,
          });
        }
      }
    }
  }
  const deduped = dedupeCandidateUnits(recovered, 24);
  const recoveredOnly = deduped.filter((candidate) => candidate.recovered);
  if (recoveredOnly.length) {
    return recoveredOnly;
  }
  const withoutBlockedComplexCoda = deduped.filter(
    (candidate) => candidate.units.every((syllable) => !isBlockedUnsupportedComplexCodaSyllable(syllable)),
  );
  const recoveryPool = withoutBlockedComplexCoda.length ? withoutBlockedComplexCoda : deduped;
  const rankedWholeGivenPool = recoveryPool.filter((candidate) => hasSupportedWholeGivenName(candidate.units));
  const allowedPool = recoveryPool.filter(
    (candidate) => candidate.units.every((syllable) => isAllowedNameSyllable(syllable)),
  );
  if (rankedWholeGivenPool.length) {
    return dedupeCandidateUnits(rankedWholeGivenPool.concat(allowedPool), 24);
  }
  return allowedPool.length ? allowedPool : recoveryPool;
}

function recoverRomanDuumGivenCandidates(candidates) {
  const recovered = [...(candidates || [])];
  for (const candidate of candidates || []) {
    const units = candidate.units || [];
    const chunks = candidate.chunks || [];
      for (let index = 0; index < Math.min(units.length, chunks.length); index += 1) {
        const chunk = chunks[index] || "";
        if (!/^[rl]y(?:a|e|o|u|i)/.test(chunk)) continue;
        const current = decomposeHangulSyllable(units[index]);
        if (!current || !DUUM_RECOVERY_VOWELS.has(current.vowel)) continue;

      if (current.onset === "ㅇ") {
        const restored = composeHangulSyllable("ㄹ", current.vowel, current.coda);
        if (!restored || !isPlausibleRecoveredDuumSyllable(restored)) continue;
        const nextUnits = units.slice();
        nextUnits[index] = restored;
        recovered.push({
          units: nextUnits,
          chunks: chunks.slice(),
          score: Number(candidate.score) + 260,
          recoveredRomanDuum: true,
        });
        continue;
      }

      if (current.onset === "ㄹ" && isPlausibleRecoveredDuumSyllable(units[index])) {
        recovered.push({
          units: units.slice(),
          chunks: chunks.slice(),
          score: Number(candidate.score) + 180,
          recoveredRomanDuum: true,
        });
      }
    }
  }
  return dedupeCandidateUnits(recovered, 24);
}

function pruneKanaSingleTokenGivenCandidates(candidates) {
  if (!candidates.length) return candidates;
  const bestCompact = candidates.find((candidate) => candidate.units.length <= 2);
  if (!bestCompact) return candidates;
  const bestAllowedCompact = candidates.find(
    (candidate) => candidate.units.length <= 2 && candidate.units.every((syllable) => isAllowedNameSyllable(syllable)),
  );
  return candidates.filter((candidate) => {
    if (bestAllowedCompact) {
      if (candidate.units.length > bestAllowedCompact.units.length && bestAllowedCompact.score >= candidate.score * 0.8) return false;
    }
    if (candidate.units.length > bestCompact.units.length && bestCompact.score >= candidate.score * 0.85) return false;
    return true;
  });
}

function buildKanaGivenCombosForUnits(units) {
  let givenCombos = [{ text: "", score: 0, parts: [] }];
  for (const [syllableIndex, syllable] of units.entries()) {
    const syllableData = state.data.syllables[syllable];
    const variants = augmentInitialGivenKanaVariants(syllable, syllableData?.kana || [], syllableIndex);
    if (!variants.length) {
      return [];
    }
    const next = [];
    for (const combo of givenCombos) {
      for (const variant of variants.slice(0, 4)) {
        next.push({
          text: `${combo.text}${variant.text}`,
          parts: (combo.parts || []).concat(variant.text),
          score: combo.score + Number(variant.score),
        });
      }
    }
    givenCombos = next.sort((a, b) => b.score - a.score).slice(0, 18);
  }
  return givenCombos;
}

function generatePronouncedGivenSurfaceVariants(units) {
  let surfaces = [{ units: units.slice(), scoreScale: 1 }];
  for (let index = 1; index < units.length; index += 1) {
    const next = [];
    for (const surface of surfaces) {
      next.push(surface);
      const previous = decomposeHangulSyllable(surface.units[index - 1]);
      const current = decomposeHangulSyllable(surface.units[index]);
      if (!previous || !current) continue;
      if (!DUUM_RECOVERY_VOWELS.has(current.vowel)) continue;
      if (!["ㅇ", "ㄹ"].includes(current.onset)) continue;
      const pronouncedCoda = previous.coda === "ㄱ" ? "ㅇ" : previous.coda === "ㄷ" ? "ㄴ" : previous.coda === "ㅂ" ? "ㅁ" : "";
      if (!pronouncedCoda) continue;
      const pronouncedPrevious = composeHangulSyllable(previous.onset, previous.vowel, pronouncedCoda);
      const pronouncedCurrent = composeHangulSyllable("ㄴ", current.vowel, current.coda);
      if (!pronouncedPrevious || !pronouncedCurrent) continue;
      const transformed = surface.units.slice();
      transformed[index - 1] = pronouncedPrevious;
      transformed[index] = pronouncedCurrent;
      next.push({
        units: transformed,
        scoreScale: surface.scoreScale * 0.9,
      });
    }
    surfaces = dedupeScoredByField(
      next.map((item) => ({ surface: item.units.join(""), score: item.scoreScale })),
      "surface",
      "score",
      8,
    ).map((item) => ({ units: Array.from(item.surface), scoreScale: item.score }));
  }
  return surfaces.filter((item) => item.units.join("") !== units.join(""));
}

function reattachGiyeokToFollowingYGlideKana(previousPart, currentPart) {
  if (!previousPart || !currentPart) return null;
  const previousTrimmed = previousPart.replace(/[クグ]$/, "");
  if (previousTrimmed === previousPart) return null;
  const mapping = [
    ["イェ", "ギェ"],
    ["ヤ", "ギャ"],
    ["ユ", "ギュ"],
    ["ヨ", "ギョ"],
    ["イ", "ギ"],
  ];
  for (const [from, to] of mapping) {
    if (currentPart.startsWith(from)) {
      return [previousTrimmed, `${to}${currentPart.slice(from.length)}`];
    }
  }
  return null;
}

function generateVoicedGiyeokKanaVariants(parts, units) {
  let surfaces = [{ parts: parts.slice(), scoreScale: 1 }];
  for (let index = 1; index < units.length; index += 1) {
    const next = [];
    for (const surface of surfaces) {
      next.push(surface);
      const previous = decomposeHangulSyllable(units[index - 1]);
      const current = decomposeHangulSyllable(units[index]);
      if (!previous || !current) continue;
      if (previous.coda !== "ㄱ") continue;
      if (!DUUM_RECOVERY_VOWELS.has(current.vowel)) continue;
      if (!["ㅇ", "ㄹ"].includes(current.onset)) continue;
      const transformed = reattachGiyeokToFollowingYGlideKana(surface.parts[index - 1], surface.parts[index]);
      if (!transformed) continue;
      const nextParts = surface.parts.slice();
      nextParts[index - 1] = transformed[0];
      nextParts[index] = transformed[1];
      next.push({
        parts: nextParts,
        scoreScale: surface.scoreScale * 0.82,
      });
    }
    surfaces = dedupeScoredByField(
      next.map((item) => ({ surface: item.parts.join("\u0000"), score: item.scoreScale })),
      "surface",
      "score",
      8,
    ).map((item) => ({ parts: item.surface.split("\u0000"), scoreScale: item.score }));
  }
  return surfaces.filter((item) => item.parts.join("") !== parts.join(""));
}

function assimilateCodaBeforeRieulKanaPart(part, coda) {
  const nasalCarrier = ["ㄱ", "ㄲ", "ㅋ"].includes(coda)
    ? "ン"
    : ["ㄷ", "ㅅ", "ㅆ", "ㅈ", "ㅊ", "ㅌ", "ㅎ"].includes(coda)
      ? "ン"
      : ["ㅂ", "ㅍ"].includes(coda)
        ? "ム"
        : coda === "ㅇ"
          ? "ン"
          : coda === "ㅁ"
            ? "ム"
            : "";
  if (!nasalCarrier) return null;
  if (part.endsWith(nasalCarrier) && ["ㅇ", "ㅁ"].includes(coda)) return part;
  const carriers = ["ㄱ", "ㄲ", "ㅋ"].includes(coda)
    ? ["ク", "グ"]
    : ["ㄷ", "ㅅ", "ㅆ", "ㅈ", "ㅊ", "ㅌ", "ㅎ"].includes(coda)
      ? ["ツ", "ト", "ッ", "チ"]
      : ["ㅂ", "ㅍ"].includes(coda)
        ? ["プ", "ブ"]
        : [];
  for (const carrier of carriers) {
    if (part.endsWith(carrier)) return `${part.slice(0, -carrier.length)}${nasalCarrier}`;
  }
  return null;
}

function applyStopNasalRieulKana(nextKana) {
  const text = normalizeKana(nextKana);
  const rieulMap = [
    ["リャ", "ニャ"], ["リュ", "ニュ"], ["リョ", "ニョ"], ["リェ", "ニェ"],
    ["ラ", "ナ"], ["リ", "ニ"], ["ル", "ヌ"], ["レ", "ネ"], ["ロ", "ノ"],
  ];
  for (const [from, to] of rieulMap) {
    if (text.startsWith(from)) return `${to}${text.slice(from.length)}`;
  }
  return applyNieunLiaison(text);
}

function generateStopNasalKanaVariants(parts, units) {
  let surfaces = [{ parts: parts.slice(), scoreScale: 1 }];
  for (let index = 1; index < units.length; index += 1) {
    const next = [];
    for (const surface of surfaces) {
      next.push(surface);
      const previous = decomposeHangulSyllable(units[index - 1]);
      const current = decomposeHangulSyllable(units[index]);
      if (!previous || !current) continue;
      const supportsRieulAssimilation =
        current.onset === "ㄹ" || (current.onset === "ㅇ" && DUUM_RECOVERY_VOWELS.has(current.vowel));
      if (!supportsRieulAssimilation) continue;
      const nasalizedPrevious = assimilateCodaBeforeRieulKanaPart(surface.parts[index - 1] || "", previous.coda);
      if (!nasalizedPrevious) continue;

      const nasalizedParts = surface.parts.slice();
      nasalizedParts[index - 1] = nasalizedPrevious;
      // Japanese sources show both the fully nasalized
      // form (ソンニョル) and the form that keeps the following glide (ソンヨル).
      next.push({ parts: nasalizedParts, scoreScale: surface.scoreScale * 1.1 });

      const nasalizedCurrent = applyStopNasalRieulKana(nasalizedParts[index] || "");
      if (nasalizedCurrent) {
        const fullyNasalizedParts = nasalizedParts.slice();
        fullyNasalizedParts[index] = nasalizedCurrent;
        next.push({ parts: fullyNasalizedParts, scoreScale: surface.scoreScale * 1.16 });
      }
    }
    surfaces = dedupeScoredByField(
      next.map((item) => ({ surface: item.parts.join("\u0000"), score: item.scoreScale })),
      "surface",
      "score",
      12,
    ).map((item) => ({ parts: item.surface.split("\u0000"), scoreScale: item.score }));
  }
  return surfaces.filter((item) => item.parts.join("") !== parts.join(""));
}

function trailingCodaClass(text) {
  if (!text) return "";
  if (text.endsWith("ng")) return "ng";
  if (text.endsWith("m")) return "m";
  if (text.endsWith("n")) return "n";
  if (text.endsWith("l") || text.endsWith("r")) return "l";
  if (text.endsWith("k") || text.endsWith("g") || text.endsWith("c")) return "k";
  return "";
}

function consonantSignature(text) {
  return normalizeLatin(text).replace(/[aeiouy]/g, "");
}

function preservesTrailingCoda(norm, key) {
  const normCoda = trailingCodaClass(norm);
  if (!normCoda) return true;
  const keyCoda = trailingCodaClass(key);
  if (normCoda === "n") return keyCoda === "n" || keyCoda === "ng";
  if (normCoda === "k") return keyCoda === "k";
  return keyCoda === normCoda;
}

function collapsedVowelSignature(text) {
  return (text.match(/[aeiouy]+/g) || []).join("").replace(/([aeiouy])\1+/g, "$1");
}

function normalizedVowelChunks(text) {
  return (normalizeLatin(text).match(/[aeiouy]+/g) || []).map((chunk) => {
    if (chunk === "ou") return "oo";
    return chunk;
  });
}

function preservesCoreVowels(norm, key) {
  const normChunks = normalizedVowelChunks(norm);
  const keyChunks = normalizedVowelChunks(key);
  if (!normChunks.length || !keyChunks.length) return true;
  if (normChunks.length !== keyChunks.length) return false;
  return normChunks.every((chunk, index) => chunk === keyChunks[index]);
}

function hasOddInitialHCluster(text) {
  return /^(?:nh|rh|lh|mh|bh|dh|gh|zh)/.test(text);
}

function buildObservedGivenRomanIndex(data) {
  const surnameByHangul = new Map((data.surnames || []).map((item) => [item.hangul, item]));
  const index = new Map();

  for (const row of data.fullNames || []) {
    const surnameData = surnameByHangul.get(row.surname);
    const surnameVariants = new Set(
      ((surnameData?.latin || []).map((item) => normalizeLatin(item.text)).filter(Boolean)).concat(normalizeLatin(row.surname)),
    );

    for (const item of row.romanizations || []) {
      const groups = splitRomanGroups(item.text);
      if (groups.length < 2) continue;

      const firstGroup = groups[0].join("");
      const lastGroup = groups[groups.length - 1].join("");
      let givenToken = "";

      if (surnameVariants.has(firstGroup)) {
        givenToken = groups.slice(1).flat().join("");
      } else if (surnameVariants.has(lastGroup)) {
        givenToken = groups.slice(0, -1).flat().join("");
      }

      if (!givenToken) continue;
      const bucket = index.get(givenToken) || new Map();
      bucket.set(row.given, Math.max(Number(item.score || 0) + Number(row.weight || 0), bucket.get(row.given) || 0));
      index.set(givenToken, bucket);
    }
  }

  return index;
}

function buildKnownGivenRomanIndex(data) {
  const index = buildObservedGivenRomanIndex(data);

  for (const [token, items] of Object.entries(data.supplementalGivenRomanIndex || {})) {
    const bucket = index.get(token) || new Map();
    for (const item of items || []) {
      if (!item.given) continue;
      bucket.set(item.given, Math.max(Number(item.score) || 0, bucket.get(item.given) || 0));
    }
    index.set(token, bucket);
  }

  for (const [given, meta] of Object.entries(data.givenNames || {})) {
    const units = Array.from(given);
    if (!units.length || units.length > 3) continue;

    let combos = [{ text: "", score: 0 }];
    let viable = true;
    for (const [syllableIndex, syllable] of units.entries()) {
      const syllableData = data.syllables?.[syllable];
      let variants = (syllableData?.latin || [])
        .map((item) => ({
          text: normalizeLatin(item.text),
          score: givenRomanContextScore(syllable, item.text, item.score),
        }))
        .filter((item) => item.text)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

      if (syllable === "이" && syllableIndex > 0) {
        const filtered = variants.filter((item) => item.text !== "lee");
        if (filtered.length) variants = filtered;
      }

      if (!variants.length) {
        viable = false;
        break;
      }

      const next = [];
      for (const combo of combos) {
        for (const variant of variants) {
          next.push({
            text: `${combo.text}${variant.text}`,
            score: combo.score + variant.score,
          });
        }
      }
      combos = next.sort((a, b) => b.score - a.score).slice(0, 24);
    }

    if (!viable) continue;

    const weightBoost =
      Math.log1p(Number(meta.totalWeight || 0)) * 8 +
      Number(meta.periodsPresentCount || 0) * 10 +
      Math.log1p(Number(meta.datasetCount || 0) + Number(meta.rowOccurrences || 0)) * 12;

    for (const combo of combos) {
      if (!combo.text) continue;
      const bucket = index.get(combo.text) || new Map();
      bucket.set(given, Math.max(combo.score + weightBoost, bucket.get(given) || 0));
      index.set(combo.text, bucket);
    }
  }

  return index;
}

function buildKnownGivenKanaIndex(data) {
  const index = new Map();
  const add = (surface, given, score) => {
    const key = normalizeKana(surface);
    if (!key || !given) return;
    const bucket = index.get(key) || new Map();
    bucket.set(given, Math.max(Number(score) || 0, bucket.get(given) || 0));
    index.set(key, bucket);
  };

  for (const [surface, items] of Object.entries(data.givenNameKanaIndex || {})) {
    for (const item of items || []) {
      add(surface, item.hangul, Number(item.score) || 0);
    }
  }

  for (const [given, meta] of Object.entries(data.givenNames || {})) {
    const units = Array.from(given);
    if (!units.length || units.length > 3) continue;
    const weightBoost =
      Math.log1p(Number(meta.totalWeight || 0)) * 8 +
      Number(meta.periodsPresentCount || 0) * 10 +
      Math.log1p(Number(meta.datasetCount || 0) + Number(meta.rowOccurrences || 0)) * 12;
    for (const item of generateGivenKanaOutputs(given)) {
      add(item.text, given, Number(item.score || 0) + weightBoost);
    }
  }

  return index;
}

function buildRuntime(data) {
  const latinVariantLengths = [...new Set(Object.keys(data.syllableLatinIndex).map((key) => key.length))].sort((a, b) => b - a);
  const kanaVariantLengths = [...new Set(Object.keys(data.syllableKanaIndex).map((key) => key.length))].sort((a, b) => b - a);
  const surnameLatinKeysByFirst = new Map();
  const syllableLatinKeysByFirst = new Map();
  const syllableKanaKeysByFirst = new Map();
  const compoundSurnames = new Set(data.meta.compoundSurnames);

  for (const key of Object.keys(data.surnameLatinIndex)) {
    const first = key[0] || "";
    const list = surnameLatinKeysByFirst.get(first) || [];
    list.push(key);
    surnameLatinKeysByFirst.set(first, list);
  }
  for (const key of Object.keys(data.syllableLatinIndex)) {
    const first = key[0] || "";
    const list = syllableLatinKeysByFirst.get(first) || [];
    list.push(key);
    syllableLatinKeysByFirst.set(first, list);
  }
  for (const key of Object.keys(data.syllableKanaIndex)) {
    const first = key[0] || "";
    const list = syllableKanaKeysByFirst.get(first) || [];
    list.push(key);
    syllableKanaKeysByFirst.set(first, list);
  }

  const fullNameRowsByGiven = new Map();
  const fullNameRowsBySurname = new Map();
  for (const row of data.fullNames || []) {
    const givenList = fullNameRowsByGiven.get(row.given) || [];
    givenList.push(row);
    fullNameRowsByGiven.set(row.given, givenList);
    const surnameList = fullNameRowsBySurname.get(row.surname) || [];
    surnameList.push(row);
    fullNameRowsBySurname.set(row.surname, surnameList);
  }

  return {
    latinVariantLengths,
    kanaVariantLengths,
    surnameLatinKeysByFirst,
    syllableLatinKeysByFirst,
    syllableKanaKeysByFirst,
    compoundSurnames,
    surnameByHangul: new Map(data.surnames.map((item) => [item.hangul, item])),
    fullNameByIndex: data.fullNames,
    givenRomanIndex: buildKnownGivenRomanIndex(data),
    givenKanaIndex: buildKnownGivenKanaIndex(data),
    fullNameRowsByGiven,
    fullNameRowsBySurname,
  };
}

function buildRomanSuggestionIndex(data) {
  const entries = [];
  for (const surname of data.surnames || []) {
    for (const item of surname.latin || []) {
      entries.push({ text: item.text, weight: Number(item.score || 0) + Math.log1p(Number(surname.population || 0)) * 20 });
    }
  }
  for (const [roman, items] of Object.entries(data.syllableLatinIndex || {})) {
    for (const item of items || []) entries.push({ text: roman, weight: Number(item.score || 0) });
  }
  for (const row of data.fullNames || []) {
    for (const item of row.romanizations || []) {
      entries.push({ text: item.text, weight: Number(item.score || 0) + Number(row.weight || 0) });
    }
  }
  return createKoreanRomanSuggestionIndex(entries);
}

function addCandidate(candidateMap, hangul, score, evidence, meta = {}) {
  if (!hangul) return;
  const kind = meta.kind || "full";
  const key = candidateKey(hangul, kind);
  const current = candidateMap.get(key) || { hangul, kind, score: -Infinity, evidence: new Set(), exactIds: new Set() };
  current.score = Math.max(current.score, score);
  if (evidence) current.evidence.add(evidence);
  candidateMap.set(key, current);
}

function collapseDuplicateStandaloneRoles(candidateMap) {
  const output = new Map();
  const standaloneByHangul = new Map();

  for (const candidate of candidateMap.values()) {
    if (candidate.kind === "full") {
      output.set(candidateKey(candidate.hangul, candidate.kind), candidate);
      continue;
    }
    const group = standaloneByHangul.get(candidate.hangul) || [];
    group.push(candidate);
    standaloneByHangul.set(candidate.hangul, group);
  }

  for (const candidates of standaloneByHangul.values()) {
    if (candidates.length === 1) {
      const [candidate] = candidates;
      output.set(candidateKey(candidate.hangul, candidate.kind), candidate);
      continue;
    }

    const ranked = [...candidates].sort((a, b) => candidateRankingScore(b) - candidateRankingScore(a));
    const primary = ranked[0];
    const merged = {
      ...primary,
      score: Math.max(...candidates.map((candidate) => Number(candidate.score) || 0)),
      roleKinds: new Set(candidates.map((candidate) => candidate.kind)),
      evidence: new Set(candidates.flatMap((candidate) => [...(candidate.evidence || [])])),
      exactIds: new Set(candidates.flatMap((candidate) => [...(candidate.exactIds || [])])),
    };
    output.set(candidateKey(merged.hangul, merged.kind), merged);
  }

  return output;
}

function addExactNameCandidates(query, candidateMap) {
  const { data } = state;
  const hangul = extractHangul(query);
  if (hangul && data.fullNameExactHangul[hangul]) {
    for (const index of data.fullNameExactHangul[hangul]) {
      const row = data.fullNames[index];
      addCandidate(candidateMap, row.hangul, 48 + row.weight, "Exact Hangul name match");
      candidateMap.get(candidateKey(row.hangul, "full")).exactIds.add(index);
    }
  }

  const hanja = extractHanja(query);
  if (hanja && data.fullNameExactHanja[hanja]) {
    for (const index of data.fullNameExactHanja[hanja]) {
      const row = data.fullNames[index];
      addCandidate(candidateMap, row.hangul, 45 + row.weight, "Exact Hanja name match");
      candidateMap.get(candidateKey(row.hangul, "full")).exactIds.add(index);
    }
  }

  const latin = normalizeLatin(query);
  if (latin && data.supplementalRomanIndex?.[latin]) {
    for (const item of data.supplementalRomanIndex[latin]) {
      addCandidate(
        candidateMap,
        item.hangul,
        24 + Math.log1p(Number(item.score) || 0) * 8,
        "Supplemental attested Roman query match",
      );
    }
  }
  if (latin && data.fullNameRomanIndex[latin]) {
    for (const item of data.fullNameRomanIndex[latin]) {
      const row = data.fullNames[item.index];
      addCandidate(candidateMap, row.hangul, 24 + Number(item.score) + row.weight, "Exact Romanized name match");
      candidateMap.get(candidateKey(row.hangul, "full")).exactIds.add(item.index);
    }
  }

  const kana = normalizeKana(query);
  if (kana && data.fullNameKanaIndex[kana]) {
    for (const item of data.fullNameKanaIndex[kana]) {
      const row = data.fullNames[item.index];
      addCandidate(candidateMap, row.hangul, 24 + Number(item.score) + row.weight, "Exact kana name match");
      candidateMap.get(candidateKey(row.hangul, "full")).exactIds.add(item.index);
    }
  }
}

function surnameLatinShapeAllowed(token, hangul) {
  const surname = state.runtime?.surnameByHangul?.get(hangul);
  if (!surname?.latin?.length) return true;
  const norm = normalizeLatin(token);
  if (!norm) return true;
  if (BLOCKED_SURNAME_ROMAN_BY_HANGUL.get(hangul)?.has(norm)) return false;

  const aliases = surname.latin
    .map((item) => ({
      norm: normalizeLatin(item.text),
      score: Number(item.score) || 0,
    }))
    .filter((item) => item.norm);
  if (!aliases.length) return true;
  if (aliases.some((item) => item.norm === norm)) return true;

  const bestAlias = aliases.reduce((best, item) => (item.score > best.score ? item : best), aliases[0]);
  if (preservesCoreVowels(norm, bestAlias.norm) && preservesTrailingCoda(norm, bestAlias.norm)) {
    return true;
  }

  return aliases.some(
    (item) =>
      item.score >= bestAlias.score * 0.75 &&
      preservesCoreVowels(norm, item.norm) &&
      preservesTrailingCoda(norm, item.norm),
  );
}

function findSurnameCandidatesFromLatin(token) {
  const norm = normalizeLatin(token);
  if (!norm) return [];
  const { data, runtime } = state;
  const shorthandSuggestion = !hasRomanVowel(norm)
    ? analyzeLatinNameInput(norm, runtime?.romanSuggestionIndex).suggestion
    : null;
  if (!hasRomanVowel(norm) && !shorthandSuggestion) return [];
  const results = [];
  for (const variant of expandRomanTokenVariants(token)) {
    const direct = data.surnameLatinIndex[variant.token];
    if (direct) {
      for (const item of direct) {
        if (!surnameLatinShapeAllowed(variant.token, item.hangul)) continue;
        results.push({ hangul: item.hangul, score: Number(item.score) - variant.penalty });
      }
      continue;
    }

    const first = variant.token[0] || "";
    const keys = runtime.surnameLatinKeysByFirst.get(first) || [];
    const fuzzy = keys
      .filter((key) => {
        if (Math.abs(key.length - variant.token.length) > 1) return false;
        if (levenshtein(key, variant.token) > 1) return false;
        if (!preservesTrailingCoda(variant.token, key)) return false;
        if (!preservesCoreVowels(variant.token, key)) return false;
        if (variant.token.length >= 5 && consonantSignature(key) !== consonantSignature(variant.token)) return false;
        return true;
      })
      .flatMap((key) =>
        data.surnameLatinIndex[key]
          .filter((item) => surnameLatinShapeAllowed(variant.token, item.hangul))
          .map((item) => ({ hangul: item.hangul, score: Number(item.score) * 0.78 - variant.penalty })),
      );
    results.push(...fuzzy);
  }
  return dedupeScoredByField(results, "hangul", "score", 8);
}

function findSurnameCandidatesFromKana(token) {
  const norm = normalizeKana(token);
  if (!norm) return [];
  return mergeKanaCandidateLists(state.data.surnameKanaIndex[norm] || [], kanaSurnameAliases(norm), "hangul", 8);
}

function findSurnameCandidatesFromHanja(token) {
  return state.data.surnameHanjaIndex[token] || [];
}

function findSurnameCandidatesFromHangul(token) {
  const norm = extractHangul(token);
  if (!norm) return [];
  const options = [];
  if (state.runtime.compoundSurnames.has(norm.slice(0, 2))) {
    options.push({ hangul: norm.slice(0, 2), score: 18 });
  }
  options.push({ hangul: norm.slice(0, 1), score: 16 });
  return options.filter((item, idx, arr) => item.hangul && arr.findIndex((other) => other.hangul === item.hangul) === idx);
}

function fuzzyLookup(norm, index, keyMap, targetField, penalty = 0.72) {
  if (!norm) return [];
  if (!hasRomanVowel(norm)) return [];
  if (hasOddInitialHCluster(norm)) return [];
  const keys = keyMap.get(norm[0] || "") || [];
  const out = [];
  for (const key of keys) {
    if (!hasRomanVowel(key)) continue;
    if (Math.abs(key.length - norm.length) > 1) continue;
    const distance = levenshtein(key, norm);
    if (distance > 1) continue;
    const adjacentKeyInsertion = norm.length === key.length + 1 && keyboardWeightedDistance(norm, key) <= 0.45;
    if (!adjacentKeyInsertion && !preservesTrailingCoda(norm, key)) continue;
    if (!adjacentKeyInsertion && !preservesCoreVowels(norm, key)) continue;
    if (!adjacentKeyInsertion && norm.length >= 3 && consonantSignature(norm) !== consonantSignature(key)) continue;
    const distancePenalty = distance === 0 ? 1 : adjacentKeyInsertion ? 0.42 : 0.12;
    for (const item of index[key] || []) {
      out.push({ [targetField]: item[targetField], score: Number(item.score) * penalty * distancePenalty });
    }
  }
  return dedupeScoredByField(out, targetField, "score", 10);
}

function singleTokenRomanChunkAdjustment(token, chunks, units) {
  const norm = normalizeLatin(token);
  if (!norm || !chunks?.length || !units?.length) return 0;

  let adjustment = 0;
  if (units.length > 2) adjustment -= (units.length - 2) * 140;

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index] || "";
    if (chunk.length === 1) adjustment -= 160;
    else if (chunk.length === 2) adjustment -= index === 0 ? 28 : 60;
    if (chunk.length <= 2 && /^[^aeiouy][aeiouy]$/i.test(chunk)) adjustment -= 70;
  }

  for (let index = 0; index < chunks.length - 1; index += 1) {
    const left = chunks[index] || "";
    const right = chunks[index + 1] || "";
    const leftLast = left.slice(-1);
    const rightFirst = right[0] || "";
    if (/[aeiouy]/.test(leftLast) && /[aeiouy]/.test(rightFirst)) {
      adjustment -= leftLast === rightFirst ? 180 : 50;
    }
  }

  const chunkPairs = chunks.slice(0, -1).map((chunk, index) => [chunk, chunks[index + 1] || ""]);
  if (/ng[kg]/.test(norm)) {
    const aligned = chunkPairs.some(([left, right]) => left.endsWith("ng") && /^[kg]/.test(right));
    const misaligned = chunkPairs.some(([left, right]) => left.endsWith("n") && /^[kg]/.test(right));
    adjustment += aligned ? 120 : -180;
    if (misaligned) adjustment -= 90;
  }
  if (/ng(?:ch|j)/.test(norm)) {
    const aligned = chunkPairs.some(([left, right]) => left.endsWith("ng") && /^(ch|j)/.test(right));
    const misaligned = chunkPairs.some(([left, right]) => left.endsWith("n") && /^(ch|j)/.test(right));
    adjustment += aligned ? 90 : -140;
    if (misaligned) adjustment -= 75;
  }

  for (let index = 0; index < Math.min(chunks.length, units.length); index += 1) {
    const chunk = chunks[index] || "";
    const syllable = units[index];
    const parts = decomposeHangulSyllable(syllable);
    if (!parts) continue;
    if (/^[rl]y(?:e|u|o|a)/.test(chunk)) {
      if (isPlausibleRecoveredDuumSyllable(syllable)) {
        adjustment += 920;
      } else if (parts.onset === "ㅇ") {
        adjustment -= 180;
      }
    }
  }

  return adjustment;
}

function romanChunkFitValue(chunk, syllable) {
  const key = normalizeLatin(chunk);
  if (!key || !syllable) return null;
  const matches = state.data?.syllableLatinIndex?.[key] || [];
  const contextualMatches = contextualGivenRomanCandidates(matches, key);
  const matched = contextualMatches.find((item) => item.hangul === syllable);
  if (!matched) return null;

  const score = Number(matched.score || 0);
  const topScore = Math.max(...contextualMatches.map((item) => Number(item.score || 0)), score);
  let value = 0;
  if (score >= 250) value += 1200;
  else if (score >= 80) value += 850;
  else if (score >= 20) value += 360;
  else if (score >= 8) value += 80;
  else value -= 220;

  if (topScore > score * 2.5) value -= 520;
  else if (topScore > score * 1.5) value -= 180;
  return value;
}

function romanChunksFitAdjustment(chunks, units) {
  if (!chunks?.length || !units?.length || chunks.length !== units.length) return null;
  let adjustment = 0;
  for (let index = 0; index < units.length; index += 1) {
    const value = romanChunkFitValue(chunks[index], units[index]);
    if (value == null) return null;
    adjustment += value;
  }
  return adjustment;
}

function bestJoinedRomanFitAdjustment(surface, units) {
  const target = normalizeLatin(surface);
  if (!target || !units?.length) return null;
  const memo = new Map();

  function dfs(unitIndex, position) {
    const key = `${unitIndex}:${position}`;
    if (memo.has(key)) return memo.get(key);
    if (unitIndex === units.length) return position === target.length ? 0 : null;

    const syllable = units[unitIndex];
    const variants = (state.data?.syllables?.[syllable]?.latin || [])
      .map((item) => normalizeLatin(item.text))
      .filter(Boolean);
    let best = null;
    for (const variant of variants) {
      if (!target.startsWith(variant, position)) continue;
      const value = romanChunkFitValue(variant, syllable);
      if (value == null) continue;
      const tail = dfs(unitIndex + 1, position + variant.length);
      if (tail == null) continue;
      const candidate = value + tail;
      best = best == null ? candidate : Math.max(best, candidate);
    }
    memo.set(key, best);
    return best;
  }

  return dfs(0, 0);
}

function romanGivenChunkFitAdjustment(candidate) {
  const units = candidate?.units || [];
  const chunks = (candidate?.chunks || []).map((chunk) => normalizeLatin(chunk)).filter(Boolean);
  if (!units.length || !chunks.length) return 0;

  const direct = romanChunksFitAdjustment(chunks, units);
  if (direct != null) return direct;

  if (chunks.length === 1 && units.length > 1) {
    const joined = bestJoinedRomanFitAdjustment(chunks[0], units);
    if (joined != null) return joined;
  }

  return 0;
}

function parseSyllablesLatin(norm, maxUnits = 3) {
  const { data, runtime } = state;
  if (!norm) return [];
  const memo = new Map();

  function dfs(pos, used) {
    const key = `${pos}:${used}`;
    if (memo.has(key)) return memo.get(key);
    if (pos === norm.length) return [{ units: [], score: 0 }];
    if (used >= maxUnits) return [];

    const results = [];
    for (const len of runtime.latinVariantLengths) {
      if (pos + len > norm.length) continue;
      const chunk = norm.slice(pos, pos + len);
      if (!chunk) continue;
      if (!hasRomanVowel(chunk)) continue;
      const forced = forcedRomanHangulCandidates(chunk);
      const exactSource = forced || contextualGivenRomanCandidates(data.syllableLatinIndex[chunk] || [], chunk);
      const exact = pruneWeakExactSyllableMatches(exactSource, chunk);
      for (const item of exact) {
        for (const tail of dfs(pos + len, used + 1)) {
          results.push({
            units: [item.hangul, ...tail.units],
            score: Number(item.score) + tail.score,
            chunks: [chunk, ...(tail.chunks || [])],
          });
        }
      }
    }

    if (!results.length) {
      const chunk = norm.slice(pos);
      for (const item of fuzzyLookup(chunk, data.syllableLatinIndex, runtime.syllableLatinKeysByFirst, "hangul", 0.62)) {
        results.push({ units: [item.hangul], score: Number(item.score), chunks: [chunk] });
      }
    }

    const deduped = dedupeCandidateUnits(results, 24).map((item) => ({
      units: item.units,
      score: item.score,
      chunks: item.chunks || [],
    }));
    const filtered = filterEvidenceBackedGivenCandidates(deduped);
    memo.set(key, filtered);
    return filtered;
  }

  return dfs(0, 0);
}

function parseSyllablesKana(norm, maxUnits = 3) {
  const { data, runtime } = state;
  if (!norm) return [];
  const memo = new Map();

  function dfs(pos, used) {
    const key = `${pos}:${used}`;
    if (memo.has(key)) return memo.get(key);
    if (pos === norm.length) return [{ units: [], score: 0 }];
    if (used >= maxUnits) return [];

    const results = [];
    for (const len of runtime.kanaVariantLengths) {
      if (pos + len > norm.length) continue;
      const chunk = norm.slice(pos, pos + len);
      if (!chunk) continue;
      const exact = lookupKanaChunkCandidates(chunk);
      for (const item of exact) {
        for (const tail of dfs(pos + len, used + 1)) {
          results.push({
            units: [item.hangul, ...tail.units],
            score: Number(item.score) + tail.score,
          });
        }
      }
    }
    const deduped = dedupeScored(
      results.map((item) => ({ text: item.units.join(""), score: item.score })),
      "text",
      "score",
      24,
    ).map((item) => ({
      units: Array.from(item.text),
      score: item.score,
    }));
    const filtered = filterEvidenceBackedGivenCandidates(deduped);
    memo.set(key, filtered);
    return filtered;
  }

  return dfs(0, 0);
}

function parseKanaReverseLiaison(norm, maxUnits = 3) {
  const text = normalizeKana(norm);
  if (!text || maxUnits < 2) return [];
  const results = [];
  const rules = [
    {
      coda: "ㄴ",
      carrier: "ン",
      restoreRight: reverseNieunLiaisonSurfaces,
      tailScale: 0.92,
      bonus: 36,
    },
    {
      coda: "ㄹ",
      carrier: "ル",
      restoreRight: reverseRieulLiaisonSurfaces,
      tailScale: 0.9,
      bonus: 32,
    },
  ];

  for (const rule of rules) {
    for (let split = 1; split < text.length; split += 1) {
      const leftSurface = text.slice(0, split);
      const rightSurface = text.slice(split);
      const restoredRightSurfaces = rule.restoreRight(rightSurface);
      if (!restoredRightSurfaces.length) continue;

      const restoredLeftCandidates = lookupKanaChunkCandidates(`${leftSurface}${rule.carrier}`).filter((item) => {
        const parts = decomposeHangulSyllable(item.hangul);
        return parts?.coda === rule.coda;
      });
      if (!restoredLeftCandidates.length) continue;

      for (const leftCandidate of restoredLeftCandidates.slice(0, 8)) {
        for (const restoredRightSurface of restoredRightSurfaces) {
          for (const tailCandidate of parseSyllablesKana(restoredRightSurface, maxUnits - 1).slice(0, 12)) {
            const units = [leftCandidate.hangul, ...(tailCandidate.units || [])];
            if (units.length < 2 || units.length > maxUnits) continue;
            results.push({
              units,
              score:
                Number(leftCandidate.score || 0) +
                Number(tailCandidate.score || 0) * rule.tailScale +
                rule.bonus,
            });
          }
        }
      }
    }
  }

  return filterEvidenceBackedGivenCandidates(dedupeCandidateUnits(results, 24));
}

function restoreStopNasalizedFollowingKana(text) {
  const norm = normalizeKana(text);
  const variants = new Set([norm]);
  const mappings = [
    ["ニャ", ["ヤ", "リャ"]], ["ニュ", ["ユ", "リュ"]], ["ニョ", ["ヨ", "リョ"]], ["ニェ", ["イェ", "リェ"]],
    ["ナ", ["ア", "ラ"]], ["ニ", ["イ", "リ"]], ["ヌ", ["ウ", "ル"]], ["ネ", ["エ", "レ"]], ["ノ", ["オ", "ロ"]],
  ];
  for (const [from, restored] of mappings) {
    if (!norm.startsWith(from)) continue;
    for (const surface of restored) variants.add(`${surface}${norm.slice(from.length)}`);
  }
  return [...variants];
}

function parseKanaReverseStopNasalization(norm, maxUnits = 3) {
  const text = normalizeKana(norm);
  if (!text || maxUnits < 2) return [];
  const rules = [
    { coda: "ㄱ", sourceCarriers: ["ク", "グ"], nasalCarrier: "ン" },
    { coda: "ㄷ", sourceCarriers: ["ツ", "ト", "ッ"], nasalCarrier: "ン" },
    { coda: "ㅂ", sourceCarriers: ["プ", "ブ"], nasalCarrier: "ム" },
    { coda: "ㅇ", sourceCarriers: ["ン"], nasalCarrier: "ン" },
    { coda: "ㅁ", sourceCarriers: ["ム"], nasalCarrier: "ム" },
  ];
  const results = [];
  for (let split = 1; split < text.length; split += 1) {
    const nasalizedLeft = text.slice(0, split);
    const right = text.slice(split);
    for (const rule of rules) {
      if (!nasalizedLeft.endsWith(rule.nasalCarrier)) continue;
      for (const carrier of rule.sourceCarriers) {
        const restoredLeft = `${nasalizedLeft.slice(0, -rule.nasalCarrier.length)}${carrier}`;
        const leftCandidates = lookupKanaChunkCandidates(restoredLeft).filter(
          (item) => decomposeHangulSyllable(item.hangul)?.coda === rule.coda,
        );
        for (const rightSurface of restoreStopNasalizedFollowingKana(right)) {
          const tailCandidates = parseSyllablesKana(rightSurface, maxUnits - 1);
          for (const leftCandidate of leftCandidates.slice(0, 8)) {
            for (const tailCandidate of tailCandidates.slice(0, 12)) {
              const units = [leftCandidate.hangul, ...(tailCandidate.units || [])];
              if (units.length < 2 || units.length > maxUnits) continue;
              results.push({
                units,
                score: Number(leftCandidate.score || 0) + Number(tailCandidate.score || 0) * 0.95 + 44,
              });
            }
          }
        }
      }
    }
  }
  return filterEvidenceBackedGivenCandidates(dedupeCandidateUnits(results, 24));
}

function parseGivenLatinTokens(tokens) {
  if (!tokens.length) return [];
  if (tokens.length === 1) {
    const results = [];
    const observed = state.runtime?.givenRomanIndex?.get(normalizeLatin(tokens[0]));
    if (observed) {
      for (const [given, score] of observed.entries()) {
        results.push({
          units: Array.from(given),
          score: Number(score) + 220,
          chunks: [normalizeLatin(tokens[0])],
          observedGiven: true,
        });
      }
    }
    for (const variant of expandRomanTokenVariants(tokens[0])) {
      for (const candidate of parseSyllablesLatin(variant.token, 3)) {
        const knownWholeGivenBoost =
          candidate.units.length <= 2 && hasSupportedWholeGivenName(candidate.units)
            ? 140 + Math.min(80, givenWholeNamePrior(candidate.units) * 0.18)
            : 0;
        results.push({
          units: candidate.units,
          score:
            candidate.score -
            variant.penalty +
            singleTokenRomanChunkAdjustment(variant.token, candidate.chunks || [], candidate.units) +
            knownWholeGivenBoost,
          chunks: candidate.chunks || [],
        });
      }
    }
    return filterEvidenceBackedGivenCandidates(recoverRomanDuumGivenCandidates(dedupeCandidateUnits(results, 24)));
  }
  const perToken = tokens.map((token) => {
    const candidates = [];
    for (const variant of expandRomanTokenVariants(token)) {
      const forced = forcedRomanHangulCandidates(variant.token);
      const exactSource = forced || contextualGivenRomanCandidates(state.data.syllableLatinIndex[variant.token] || [], variant.token);
      const exact = pruneWeakExactSyllableMatches(exactSource, variant.token);
      if (exact?.length) {
        for (const item of exact) {
          candidates.push({ units: [item.hangul], score: Number(item.score) - variant.penalty, chunks: [variant.token] });
        }
      } else {
        for (const item of fuzzyLookup(variant.token, state.data.syllableLatinIndex, state.runtime.syllableLatinKeysByFirst, "hangul", 0.62)) {
          candidates.push({ units: [item.hangul], score: Number(item.score) - variant.penalty, chunks: [variant.token] });
        }
      }
    }
    return filterEvidenceBackedGivenCandidates(recoverRomanDuumGivenCandidates(dedupeCandidateUnits(candidates, 12)));
  });
  if (perToken.some((items) => !items.length)) {
    return recoverRomanDuumGivenCandidates(parseSyllablesLatin(tokens.join(""), 3));
  }
  let combos = [{ units: [], score: 0 }];
  for (const items of perToken) {
    const next = [];
    for (const combo of combos) {
      for (const item of items.slice(0, 5)) {
        next.push({
          units: combo.units.concat(item.units),
          score: combo.score + item.score,
          chunks: (combo.chunks || []).concat(item.chunks || item.units),
        });
      }
    }
    combos = next.sort((a, b) => b.score - a.score).slice(0, 20);
  }
  return filterEvidenceBackedGivenCandidates(recoverRomanDuumGivenCandidates(combos));
}

function exactSingleSyllableGivenCandidatesForFullName(tokens) {
  if ((tokens || []).length !== 1) return [];
  const token = normalizeLatin(tokens[0]);
  if (!token) return [];
  const exactSource = contextualGivenRomanCandidates(state.data.syllableLatinIndex[token] || [], token);
  return pruneWeakExactSyllableMatches(exactSource, token)
    .filter((item) => isNameLikeGivenSyllable(item.hangul) && romanChunkFitValue(token, item.hangul) >= 360)
    .map((item) => ({
      units: [item.hangul],
      score: Number(item.score) || 0,
      chunks: [token],
    }));
}

function knownGivenCandidatesFromRomanTokens(tokens) {
  const joined = normalizeLatin((tokens || []).join(""));
  if (!joined) return [];
  const observed = state.runtime?.givenRomanIndex?.get(joined);
  if (!observed) return [];
  const supplementalGivenNames = new Set(
    (state.data?.supplementalGivenRomanIndex?.[joined] || []).map((item) => item.given).filter(Boolean),
  );
  return [...observed.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([given, score]) => ({
      units: Array.from(given),
      score: Number(score) + 240,
      chunks: [joined],
      observedGiven: true,
      supplementalRomanAlias: supplementalGivenNames.has(given),
    }));
}

function hasKnownRomanGivenTokens(tokens) {
  const joined = normalizeLatin((tokens || []).join(""));
  return !!joined && !!state.runtime?.givenRomanIndex?.has(joined);
}

function pruneRomanSingleTokenGivenCandidates(candidates) {
  if (!candidates.length) return candidates;
  const topCandidate = candidates[0];
  const topTwoUnit = candidates.find((candidate) => candidate.units.length <= 2);
  const topAllowed = candidates.find((candidate) => isFullyAllowedGivenCandidate(candidate));
  const topCompactSinoLike = candidates.find(
    (candidate) => candidate.units.length <= 2 && isSinoLikeRomanGivenCandidate(candidate),
  );
  const topCompactSinoBacked = candidates.find(
    (candidate) => candidate.units.length <= 2 && isSinoBackedGivenCandidate(candidate),
  );
  const topHanjaBackedCompact = candidates.find(
    (candidate) => candidate.units.length <= 2 && candidate.units.every((syllable) => hasHanjaGivenSupport(syllable)),
  );
  if (!topTwoUnit) return candidates;
  return candidates.filter((candidate) => {
    const hasRankedWholeGivenName = hasSupportedWholeGivenName(candidate.units);
    if (
      topCompactSinoLike &&
      !hasRankedWholeGivenName &&
      candidate.units.some((syllable) => !isSinoLikeGivenSyllable(syllable))
    ) {
      return false;
    }
    if (
      topCompactSinoBacked &&
      !hasRankedWholeGivenName &&
      !isSinoBackedGivenCandidate(candidate) &&
      topCompactSinoBacked.score >= candidate.score * 0.6
    ) {
      return false;
    }
    if (topAllowed) {
      if (!isFullyAllowedGivenCandidate(candidate) && !hasRankedWholeGivenName) return false;
      const shorterAllowed = candidates.find(
        (other) => isFullyAllowedGivenCandidate(other) && other.units.length < candidate.units.length,
      );
      if (!hasRankedWholeGivenName && shorterAllowed && shorterAllowed.score >= candidate.score * 0.7) return false;
      return hasRankedWholeGivenName || candidate.score >= topAllowed.score * 0.18;
    }
    if (
      topHanjaBackedCompact &&
      candidate.units.length > topHanjaBackedCompact.units.length &&
      candidate.units.some((syllable) => !hasHanjaGivenSupport(syllable)) &&
      topHanjaBackedCompact.score >= candidate.score * 0.35
    ) {
      return false;
    }
    const bestShorter = candidates.find((other) => other.units.length < candidate.units.length);
    if (bestShorter && bestShorter.score >= candidate.score * 0.7) {
      return candidate.units.length <= bestShorter.units.length;
    }
    if (candidate.units.length <= 2) {
      return candidate.score >= topCandidate.score * 0.22;
    }
    if (candidate.units.length > topTwoUnit.units.length && candidate.score < topTwoUnit.score * 1.35) {
      return false;
    }
    return candidate.score >= topTwoUnit.score * 0.4;
  });
}

function generateRomanDuumWholeGivenCandidates(norm) {
  const text = normalizeLatin(norm);
  if (!text) return [];
  const matches = [];
  for (const [roman, items] of Object.entries(state.data.syllableLatinIndex || {})) {
    if (!/^[rl]y(?:a|e|o|u|i)/.test(roman)) continue;
    const syllables = (items || []).filter((item) => isPlausibleRecoveredDuumSyllable(item.hangul));
    if (!syllables.length) continue;
    let fromIndex = 0;
    while (fromIndex < text.length) {
      const start = text.indexOf(roman, fromIndex);
      if (start < 0) break;
      const end = start + roman.length;
      const prefix = text.slice(0, start);
      const suffix = text.slice(end);
      const prefixCandidates = prefix ? parseSyllablesLatin(prefix, 2) : [{ units: [], score: 0, chunks: [] }];
      const suffixCandidates = suffix ? parseSyllablesLatin(suffix, 2) : [{ units: [], score: 0, chunks: [] }];
      for (const prefixCandidate of prefixCandidates.slice(0, 8)) {
        for (const syllable of syllables.slice(0, 4)) {
          for (const suffixCandidate of suffixCandidates.slice(0, 8)) {
            const units = [...(prefixCandidate.units || []), syllable.hangul, ...(suffixCandidate.units || [])];
            if (!units.length || units.length > 3) continue;
            const explicitLateralCueBoost =
              start > 0 && units.length <= 2
                ? 680
                : start > 0
                  ? 420
                  : 180;
            matches.push({
              units,
              chunks: [...(prefixCandidate.chunks || []), roman, ...(suffixCandidate.chunks || [])],
              score:
                Number(prefixCandidate.score || 0) +
                Number(syllable.score || 0) +
                Number(suffixCandidate.score || 0) +
                320 +
                explicitLateralCueBoost,
              recoveredRomanDuum: true,
            });
          }
        }
      }
      fromIndex = start + 1;
    }
  }
  return dedupeCandidateUnits(matches, 24);
}

function parseGivenKanaTokens(tokens) {
  if (!tokens.length) return [];
  const joined = normalizeKana(tokens.join(""));
  const exactGivenIndex = state.runtime?.givenKanaIndex?.get(joined);
  const exactGiven = exactGivenIndex
    ? [...exactGivenIndex.entries()].map(([hangul, score]) => ({
      units: Array.from(hangul),
      score: Number(score) + 180,
    }))
    : [];
  if (exactGiven.length) {
    return pruneKanaSingleTokenGivenCandidates(recoverPronouncedSinoGivenCandidates(dedupeCandidateUnits(exactGiven, 24)));
  }
  if (tokens.length === 1) {
    const parsed = parseSyllablesKana(tokens[0], 3)
      .concat(parseKanaReverseLiaison(tokens[0], 3))
      .concat(parseKanaReverseStopNasalization(tokens[0], 3));
    return pruneKanaSingleTokenGivenCandidates(recoverPronouncedSinoGivenCandidates(dedupeCandidateUnits(parsed, 24)));
  }
  const perToken = tokens.map((token) => lookupKanaChunkCandidates(token).map((item) => ({
    units: [item.hangul],
    score: Number(item.score),
  })));
  if (perToken.some((items) => !items.length)) {
    const joinedKana = tokens.join("");
    const joinedParsed = parseSyllablesKana(joinedKana, 3)
      .concat(parseKanaReverseLiaison(joinedKana, 3))
      .concat(parseKanaReverseStopNasalization(joinedKana, 3));
    return pruneKanaSingleTokenGivenCandidates(recoverPronouncedSinoGivenCandidates(dedupeCandidateUnits(joinedParsed, 24)));
  }
  let combos = [{ units: [], score: 0 }];
  for (const items of perToken) {
    const next = [];
    for (const combo of combos) {
      for (const item of items.slice(0, 5)) {
        next.push({ units: combo.units.concat(item.units), score: combo.score + item.score });
      }
    }
    combos = next.sort((a, b) => b.score - a.score).slice(0, 20);
  }
  return recoverPronouncedSinoGivenCandidates(filterEvidenceBackedGivenCandidates(dedupeCandidateUnits(combos, 24)));
}

function kanaJoinedSurnameBoundaryAdjustment(sourceKana, surnameVariant, surnameHangul, givenUnits = []) {
  const normVariant = normalizeKana(surnameVariant);
  const remainder = sourceKana.slice(normVariant.length);
  const carrier = remainder[0] || "";
  const expectedCodas = KANA_CODA_CARRIER_MAP.get(carrier);
  if (!expectedCodas) return 0;

  const surnameLast = Array.from(surnameHangul || "").at(-1);
  const surnameParts = decomposeHangulSyllable(surnameLast);
  if (!surnameParts) return 0;

  const totalLength = (surnameHangul || "").length + (givenUnits || []).length;
  if (expectedCodas.has(surnameParts.coda)) {
    return totalLength <= 3 ? 360 : 180;
  }
  if (!surnameParts.coda && totalLength > 3) {
    return -1500;
  }
  if (totalLength > 3) {
    return -900;
  }
  return -120;
}

function parseGivenHanja(text) {
  const norm = extractHanja(text);
  if (!norm) return [];
  let combos = [{ units: [], score: 0 }];
  for (const char of Array.from(norm)) {
    const items = hanjaGivenReadingCandidates(char);
    if (!items.length) return [];
    const next = [];
    for (const combo of combos) {
      for (const item of items.slice(0, 6)) {
        next.push({ units: combo.units.concat(item.hangul), score: combo.score + Number(item.score) });
      }
    }
    combos = next.sort((a, b) => b.score - a.score).slice(0, 30);
  }
  return filterEvidenceBackedGivenCandidates(dedupeCandidateUnits(combos, 30));
}

function hanjaFallbackReadingScore(hangul) {
  const syllable = state.data?.syllables?.[hangul];
  if (!syllable) return 0.8;
  let score = 1.1;
  if (syllable.sinoAllowed) score += 1.4;
  if (Number(syllable.hanjaGivenCount || 0) > 0) score += Math.min(3.2, Math.log1p(Number(syllable.hanjaGivenCount || 0)) * 1.15);
  score += Math.min(2.2, Math.log1p(Number(syllable.givenCount || 0) + Number(syllable.nameCount || 0)) * 0.28);
  score += Math.min(2.4, Math.log1p(Number(syllable.decadeWeight || 0)) * 0.18);
  return score;
}

function hanjaGivenReadingCandidates(char) {
  const results = [];
  for (const item of state.data?.hanjaGivenIndex?.[char] || []) {
    results.push({ hangul: item.hangul, score: Number(item.score || 0) + 4 });
  }
  for (const hangul of state.data?.hanjaReadingIndex?.[char] || []) {
    if (!hangul || !state.data?.syllables?.[hangul]) continue;
    results.push({ hangul, score: hanjaFallbackReadingScore(hangul) });
  }
  return dedupeScoredByField(results, "hangul", "score", 8);
}

function parseJoinedRomanGivenToken(token) {
  const joined = normalizeLatin(token);
  if (!joined) return [];
  const knownCandidates = knownGivenCandidatesFromRomanTokens([joined]);
  const parsedCandidates = parseGivenLatinTokens([joined]);
  return dedupeCandidateUnits(knownCandidates.concat(parsedCandidates), 24);
}

function hasNonLatinScript(groups) {
  return groups.some((group) => group.type !== "latin");
}

function addLatinFullNameHypotheses(hypotheses, candidateMap) {
  for (const hypothesis of hypotheses) {
    let surnameCandidates = findSurnameCandidatesFromLatin(hypothesis.surnameToken);
    if (hypothesis.requireCompoundSurname) {
      surnameCandidates = surnameCandidates.filter((item) => (item.hangul || "").length === 2 && state.runtime.compoundSurnames.has(item.hangul));
    }
    if (!surnameCandidates.length || !hypothesis.givenTokens.length) continue;
    let givenCandidates = knownGivenCandidatesFromRomanTokens(hypothesis.givenTokens);
    const parsedGivenCandidates = parseGivenLatinTokens(hypothesis.givenTokens);
    givenCandidates = dedupeCandidateUnits(givenCandidates.concat(parsedGivenCandidates), 24);
    if (hypothesis.givenTokens.length === 1) {
      const prunedCandidates = pruneRomanSingleTokenGivenCandidates(givenCandidates);
      givenCandidates = prunedCandidates.length
        ? prunedCandidates
        : exactSingleSyllableGivenCandidatesForFullName(hypothesis.givenTokens);
    }
    combineSurnameAndGivenCandidates(surnameCandidates, givenCandidates, candidateMap, hypothesis.boost, hypothesis.label);
  }
}

function searchHangul(query, candidateMap) {
  const hangul = extractHangul(query);
  if (!hangul || hangul.length < 2) return;
  const { surname, given } = splitNameUnits(hangul, state.runtime.compoundSurnames);
  const givenUnits = Array.from(given);
  if (!state.runtime.surnameByHangul.has(surname) || !isNameLikeGivenUnits(givenUnits)) return;
  let score = 20;
  const surnameData = state.runtime.surnameByHangul.get(surname);
  if (surnameData) score += Math.log1p(Number(surnameData.population || 0));
  for (const syllable of givenUnits) {
    const syllableData = state.data.syllables[syllable];
    if (syllableData) {
      score += Math.log1p(Number(syllableData.givenCount || 0) + Number(syllableData.nameCount || 0));
    }
  }
  addCandidate(candidateMap, hangul, score, "Name-like Hangul parse");
}

function searchLatin(query, candidateMap) {
  const latin = normalizeLatin(query);
  if (!latin) return;
  const groups = splitRomanGroups(query);
  const tokens = groups.flat();

  if (groups.length === 1 && tokens.length === 1) {
    const directCandidates = pruneRomanSingleTokenGivenCandidates(parseGivenLatinTokens(tokens)).filter(
      (candidate) => candidate.units.length === 1,
    );
    if (directCandidates.length) {
      for (const candidate of directCandidates.slice(0, 8)) {
        const hangul = candidate.units.join("");
        const score = Number(candidate.score) + givenUnitsNamePrior(candidate.units) + 40;
        addCandidate(candidateMap, hangul, score, "Roman single-syllable parse");
      }
      return;
    }
  }

  if (groups.length >= 2) {
    const firstGroupToken = groups[0].join("");
    const lastGroupToken = groups[groups.length - 1].join("");
    const firstLeeCue = isLeeSurnameCue(firstGroupToken);
    const lastLeeCue = isLeeSurnameCue(lastGroupToken);
    const surnameFirstGivenTokens = groups.slice(1).flat();
    const knownSurnameFirstGivenWithLee =
      lastLeeCue &&
      !firstLeeCue &&
      surnameFirstGivenTokens.length >= 2 &&
      hasKnownRomanGivenTokens(surnameFirstGivenTokens);
    const hypotheses = [];
    if (!lastLeeCue || firstLeeCue || knownSurnameFirstGivenWithLee) {
      hypotheses.push({
        surnameToken: firstGroupToken,
        givenTokens: surnameFirstGivenTokens,
        boost: firstLeeCue ? 1.2 : lastLeeCue ? 0.72 : 1.0,
        label: knownSurnameFirstGivenWithLee ? "Latin surname-first parse with ranked Lee-final given name" : "Latin surname-first parse",
      });
    }
    if ((!firstLeeCue || lastLeeCue) && groups[groups.length - 1].length === 1) {
      hypotheses.push({
        surnameToken: groups[groups.length - 1][0],
        givenTokens: groups.slice(0, -1).flat(),
        boost: lastLeeCue ? 1.24 : firstLeeCue ? 0.42 : 0.84,
        label: "Latin surname-last parse",
      });
    }
    if (!lastLeeCue && groups.length >= 3 && groups[0].length === 1 && groups[1].length === 1) {
      hypotheses.push({
        surnameToken: `${groups[0][0]}${groups[1][0]}`,
        givenTokens: groups.slice(2).flat(),
        boost: 1.06,
        label: "Latin compound-surname parse",
        requireCompoundSurname: true,
      });
    }
    if (!firstLeeCue && groups.length >= 3 && groups[groups.length - 2].length === 1 && groups[groups.length - 1].length === 1) {
      hypotheses.push({
        surnameToken: `${groups[groups.length - 2][0]}${groups[groups.length - 1][0]}`,
        givenTokens: groups.slice(0, -2).flat(),
        boost: 0.88,
        label: "Latin compound-surname-last parse",
        requireCompoundSurname: true,
      });
    }
    addLatinFullNameHypotheses(hypotheses, candidateMap);
  } else if (groups.length === 1 && tokens.length >= 2 && hasRomanHyphenBoundary(query)) {
    const firstToken = tokens[0];
    const lastToken = tokens[tokens.length - 1];
    const firstLeeCue = isLeeSurnameCue(firstToken);
    const lastLeeCue = isLeeSurnameCue(lastToken);
    const hypotheses = [];

    if (!lastLeeCue || firstLeeCue) {
      hypotheses.push({
        surnameToken: firstToken,
        givenTokens: tokens.slice(1),
        boost: firstLeeCue ? 1.08 : lastLeeCue ? 0.48 : 0.78,
        label: "Latin hyphenated surname-first parse",
      });
    }
    if (!firstLeeCue || lastLeeCue) {
      hypotheses.push({
        surnameToken: lastToken,
        givenTokens: tokens.slice(0, -1),
        boost: lastLeeCue ? 1.16 : firstLeeCue ? 0.38 : 0.86,
        label: "Latin hyphenated surname-last parse",
      });
    }
    if (!lastLeeCue && tokens.length >= 3) {
      hypotheses.push({
        surnameToken: `${tokens[0]}${tokens[1]}`,
        givenTokens: tokens.slice(2),
        boost: 0.96,
        label: "Latin hyphenated compound-surname parse",
        requireCompoundSurname: true,
      });
    }
    if (!firstLeeCue && tokens.length >= 3) {
      hypotheses.push({
        surnameToken: `${tokens[tokens.length - 2]}${tokens[tokens.length - 1]}`,
        givenTokens: tokens.slice(0, -2),
        boost: 0.82,
        label: "Latin hyphenated compound-surname-last parse",
        requireCompoundSurname: true,
      });
    }
    addLatinFullNameHypotheses(hypotheses, candidateMap);
  }

  if (tokens.length <= 1) {
    for (const [variant, surnameCandidates] of Object.entries(state.data.surnameLatinIndex)) {
      if (latin.startsWith(variant) && latin.length !== variant.length) {
        const givenCandidates = parseJoinedRomanGivenToken(latin.slice(variant.length));
        combineSurnameAndGivenCandidates(surnameCandidates, givenCandidates, candidateMap, 0.96, "Latin joined-string parse");
      }
      if (latin.endsWith(variant) && latin.length !== variant.length) {
        const givenCandidates = parseJoinedRomanGivenToken(latin.slice(0, -variant.length));
        combineSurnameAndGivenCandidates(surnameCandidates, givenCandidates, candidateMap, 0.94, "Latin suffix-surname parse");
      }
    }
  }
}

function searchKana(query, candidateMap) {
  const kana = normalizeKana(query);
  if (!kana) return;
  const tokens = splitKanaTokens(query);
  const spaceGroups = splitKanaSpaceGroups(query);
  const hasStrictSurnameBoundary = spaceGroups.length === 2;
  if (tokens.length >= 2) {
    const surnameCandidates = findSurnameCandidatesFromKana(tokens[0]);
    const givenCandidates = parseGivenKanaTokens(tokens.slice(1));
    combineSurnameAndGivenCandidates(surnameCandidates, givenCandidates, candidateMap, 1.0, "Kana surname-first parse");
  }

  if (hasStrictSurnameBoundary) return;

  for (const [variant, surnameCandidates] of Object.entries(state.data.surnameKanaIndex)) {
    if (!kana.startsWith(variant) || kana.length === variant.length) continue;
    const givenCandidates = parseGivenKanaTokens([kana.slice(variant.length)]);
    for (const surnameCandidate of surnameCandidates.slice(0, 10)) {
      for (const givenCandidate of givenCandidates.slice(0, 24)) {
        if (!isNameLikeGivenUnits(givenCandidate.units)) continue;
        const givenPrior = givenUnitsNamePrior(givenCandidate.units);
        const boundaryAdjustment = kanaJoinedSurnameBoundaryAdjustment(kana, variant, surnameCandidate.hangul, givenCandidate.units);
        const hangul = `${surnameCandidate.hangul}${givenCandidate.units.join("")}`;
        const score = (Number(surnameCandidate.score) + Number(givenCandidate.score)) * 0.96 + givenPrior + boundaryAdjustment;
        addCandidate(candidateMap, hangul, score, "Kana joined-string parse");
      }
    }
  }
}

function searchHanja(query, candidateMap) {
  const hanja = extractHanja(query);
  if (!hanja) return;
  const surnameKeys = hanja.length >= 2 ? [hanja.slice(0, 2), hanja.slice(0, 1)] : [hanja.slice(0, 1)];
  for (const key of surnameKeys) {
    const surnameCandidates = findSurnameCandidatesFromHanja(key);
    if (!surnameCandidates.length) continue;
    const givenCandidates = parseGivenHanja(hanja.slice(key.length));
    if (!givenCandidates.length && hanja.length === key.length) continue;
    combineSurnameAndGivenCandidates(surnameCandidates, givenCandidates, candidateMap, 0.94, "Hanja reading parse");
  }
}

function searchMixedGroups(query, candidateMap) {
  const groups = tokenizeByScript(query);
  if (groups.length < 2) return;
  if (!hasNonLatinScript(groups)) return;
  const surnameGroup = groups[0];
  const givenGroups = groups.slice(1);
  const surnameCandidates = parseSurnameGroup(surnameGroup);
  if (!surnameCandidates.length) return;
  let combos = [{ units: [], score: 0 }];
  for (const group of givenGroups) {
    const parsed = parseGivenGroup(group);
    if (!parsed.length) return;
    const next = [];
    for (const combo of combos) {
      for (const item of parsed.slice(0, 8)) {
        next.push({ units: combo.units.concat(item.units), score: combo.score + item.score });
      }
    }
    combos = next.sort((a, b) => b.score - a.score).slice(0, 30);
  }
  combineSurnameAndGivenCandidates(surnameCandidates, combos, candidateMap, 0.9, "Mixed-script segmented parse");
}

function parseSurnameGroup(group) {
  switch (group.type) {
    case "hangul":
      return findSurnameCandidatesFromHangul(group.text);
    case "latin":
      return findSurnameCandidatesFromLatin(group.text);
    case "kana":
      return findSurnameCandidatesFromKana(group.text);
    case "hanja":
      return findSurnameCandidatesFromHanja(group.text);
    default:
      return [];
  }
}

function parseGivenGroup(group) {
  switch (group.type) {
    case "hangul":
      return [{ units: Array.from(extractHangul(group.text)), score: 8 }];
    case "latin":
      return parseGivenLatinTokens(splitRomanTokens(group.text));
    case "kana":
      return parseGivenKanaTokens(splitKanaTokens(group.text));
    case "hanja":
      return parseGivenHanja(group.text);
    default:
      return [];
  }
}

function addStandaloneSurnameCandidates(candidateMap, surnameCandidates, evidence, boost = 180) {
  for (const candidate of surnameCandidates.slice(0, 10)) {
    const surnameData = state.runtime?.surnameByHangul?.get(candidate.hangul);
    const score = Number(candidate.score) + boost + Math.log1p(Number(surnameData?.population || 0)) * 8;
    addCandidate(candidateMap, candidate.hangul, score, evidence, { kind: "surname" });
  }
}

function addStandaloneGivenCandidates(candidateMap, givenCandidates, evidence, boost = 180) {
  for (const candidate of givenCandidates.slice(0, 24)) {
    if (!candidate?.units?.length) continue;
    if (!isNameLikeGivenUnits(candidate.units)) continue;
    const hangul = candidate.units.join("");
    const score =
      Number(candidate.score) +
      boost +
      givenUnitsNamePrior(candidate.units) +
      romanGivenChunkFitAdjustment(candidate);
    const candidateEvidence = candidate.supplementalRomanAlias
      ? "Supplemental attested Roman given-name match"
      : evidence;
    addCandidate(candidateMap, hangul, score, candidateEvidence, { kind: "given" });
  }
}

function searchStandaloneHangul(query, candidateMap) {
  const groups = tokenizeByScript(query);
  if (groups.length !== 1 || groups[0].type !== "hangul") return;
  const hangul = extractHangul(query);
  if (!hangul) return;

  const surnameCandidates = findSurnameCandidatesFromHangul(hangul).filter((item) => item.hangul === hangul);
  if (surnameCandidates.length) {
    addStandaloneSurnameCandidates(candidateMap, surnameCandidates, "Standalone Hangul surname search", 220);
  }

  const wholeGivenCandidates = [];
  if (state.data.givenNames?.[hangul]) {
    wholeGivenCandidates.push({
      units: Array.from(hangul),
      score: givenWholeNamePrior(Array.from(hangul)) + 120,
    });
  } else if (hangul.length <= 3 && Array.from(hangul).every((syllable) => hasGivenSyllableEvidence(syllable))) {
    wholeGivenCandidates.push({
      units: Array.from(hangul),
      score: givenUnitsNamePrior(Array.from(hangul)),
    });
  }
  if (wholeGivenCandidates.length) {
    addStandaloneGivenCandidates(candidateMap, wholeGivenCandidates, "Standalone Hangul given-name search", 220);
  }
}

function searchStandaloneLatin(query, candidateMap) {
  const groups = tokenizeByScript(query);
  if (!groups.length || groups.some((group) => group.type !== "latin")) return;
  const romanGroups = splitRomanGroups(query);
  const tokens = romanGroups.flat();
  if (!tokens.length) return;

  const joined = tokens.join("");
  if (tokens.length <= 2) {
    const surnameCandidates = findSurnameCandidatesFromLatin(joined);
    if (surnameCandidates.length) {
      addStandaloneSurnameCandidates(candidateMap, surnameCandidates, "Standalone Roman surname search", 220);
    }
  }

  let givenCandidates = knownGivenCandidatesFromRomanTokens(tokens);
  const parsedGivenCandidates = parseGivenLatinTokens(tokens);
  const romanDuumCandidates = tokens.length === 1 ? generateRomanDuumWholeGivenCandidates(tokens[0]) : [];
  if (romanDuumCandidates.length) {
    addStandaloneGivenCandidates(candidateMap, romanDuumCandidates, "Standalone Roman duum given-name search", 260);
  }
  givenCandidates = dedupeCandidateUnits(givenCandidates.concat(parsedGivenCandidates, romanDuumCandidates), 24);
  if (tokens.length === 1) {
    givenCandidates = pruneRomanSingleTokenGivenCandidates(givenCandidates);
  }
  if (givenCandidates.length) {
    addStandaloneGivenCandidates(candidateMap, givenCandidates, "Standalone Roman given-name search", 220);
  }
}

function searchStandaloneKana(query, candidateMap) {
  const groups = tokenizeByScript(query);
  if (!groups.length || groups.some((group) => group.type !== "kana")) return;
  const tokens = splitKanaTokens(query);
  if (!tokens.length) return;

  if (tokens.length <= 2) {
    const surnameCandidates = findSurnameCandidatesFromKana(tokens.join(""));
    if (surnameCandidates.length) {
      addStandaloneSurnameCandidates(candidateMap, surnameCandidates, "Standalone Kana surname search", 210);
    }
  }

  const givenCandidates = parseGivenKanaTokens(tokens);
  if (givenCandidates.length) {
    addStandaloneGivenCandidates(candidateMap, givenCandidates, "Standalone Kana given-name search", 210);
  }
}

function searchStandaloneHanja(query, candidateMap) {
  const groups = tokenizeByScript(query);
  if (groups.length !== 1 || groups[0].type !== "hanja") return;
  const hanja = extractHanja(query);
  if (!hanja) return;

  const surnameCandidates = findSurnameCandidatesFromHanja(hanja);
  if (surnameCandidates.length) {
    addStandaloneSurnameCandidates(candidateMap, surnameCandidates, "Standalone Hanja surname search", 210);
  }

  const givenCandidates = parseGivenHanja(hanja);
  if (givenCandidates.length) {
    addStandaloneGivenCandidates(candidateMap, givenCandidates, "Standalone Hanja given-name search", 210);
  }
}

function combineSurnameAndGivenCandidates(surnameCandidates, givenCandidates, candidateMap, boost, label) {
  for (const surnameCandidate of surnameCandidates.slice(0, 10)) {
    for (const givenCandidate of givenCandidates.slice(0, 24)) {
      if (!isNameLikeGivenUnits(givenCandidate.units)) continue;
      const givenPrior = givenUnitsNamePrior(givenCandidate.units);
      const hangul = `${surnameCandidate.hangul}${givenCandidate.units.join("")}`;
      const score =
        (Number(surnameCandidate.score) + Number(givenCandidate.score)) * boost +
        givenPrior +
        romanGivenChunkFitAdjustment(givenCandidate);
      const candidateEvidence = givenCandidate.supplementalRomanAlias
        ? "Supplemental attested Roman given-name match"
        : label;
      addCandidate(candidateMap, hangul, score, candidateEvidence);
    }
  }
}

function gatherExactRowsForHangul(hangul, candidate) {
  if (candidate.kind === "given") {
    return state.runtime?.fullNameRowsByGiven?.get(hangul) || [];
  }
  if (candidate.kind === "surname") {
    return state.runtime?.fullNameRowsBySurname?.get(hangul) || [];
  }
  const ids = new Set(candidate.exactIds || []);
  const exact = state.data.fullNameExactHangul[hangul] || [];
  for (const id of exact) ids.add(id);
  return [...ids].map((id) => state.data.fullNames[id]);
}

function generateGivenRomanOutputs(hangul) {
  const givenUnits = Array.from(hangul);
  const counter = new Map();
  const add = (text, score) => {
    if (!text) return;
    counter.set(text, Math.max(score, counter.get(text) || 0));
  };

  let givenCombos = [{ text: "", score: 0, parts: [] }];
  for (const [syllableIndex, syllable] of givenUnits.entries()) {
    const syllableData = state.data.syllables[syllable];
    let variants = modernGivenRomanVariantsForOutput(syllable, syllableData?.latin || [{ text: syllable, score: 1 }]).slice(0, 4);
    if (syllable === "이" && syllableIndex > 0) {
      const filtered = variants.filter((variant) => normalizeLatin(variant.text) !== "lee");
      if (filtered.length) variants = filtered;
    }
    const next = [];
    for (const combo of givenCombos) {
      for (const variant of variants) {
        next.push({
          text: `${combo.text}${variant.text}`,
          score: combo.score + Number(variant.score),
          parts: combo.parts.concat(variant.text),
        });
      }
    }
    givenCombos = next.sort((a, b) => b.score - a.score).slice(0, 18);
  }

  for (const givenCombo of givenCombos) {
    if (!givenCombo.parts.length) continue;
    add(givenCombo.parts.join(" "), givenCombo.score * 0.74);
    add(givenCombo.parts.join("-"), givenCombo.score);
    add(givenCombo.text, givenCombo.score * 0.9);
  }

  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([text, score]) => ({ text, score }));
}

function generateSurnameRomanOutputs(hangul) {
  const surnameData = state.runtime?.surnameByHangul?.get(hangul);
  return (surnameData?.latin || [])
    .slice(0, 8)
    .map((item) => ({ text: item.text, score: Number(item.score) || 0 }));
}

function generateGivenKanaOutputs(hangul) {
  const givenUnits = Array.from(hangul);
  const counter = new Map();
  const add = (text, score) => {
    if (!text) return;
    if (isBlockedJapaneseKanaSurface(text)) return;
    counter.set(text, Math.max(score, counter.get(text) || 0));
  };
  for (const item of ATTESTED_CHRISTIAN_GIVEN_KANA.get(hangul) || []) {
    add(item.text, Number(item.score) || 0);
  }
  const givenCombos = buildKanaGivenCombosForUnits(givenUnits);
  for (const combo of givenCombos) {
    const normalizedParts = normalizeKanaPartsForJoin(combo.parts || [], givenUnits);
    for (const surface of generateLiaisonKanaVariants(normalizedParts, givenUnits)) {
      add(surface.text, combo.score * surface.scoreScale);
    }
    for (const voicedSurface of generateVoicedGiyeokKanaVariants(normalizedParts, givenUnits)) {
      add(voicedSurface.parts.join(""), combo.score * voicedSurface.scoreScale);
    }
    for (const nasalSurface of generateStopNasalKanaVariants(normalizedParts, givenUnits)) {
      add(nasalSurface.parts.join(""), combo.score * nasalSurface.scoreScale);
    }
    for (const sokuonSurface of generateSokuonGeminateKanaVariants(normalizedParts, givenUnits)) {
      add(sokuonSurface.parts.join(""), combo.score * sokuonSurface.scoreScale);
    }
  }
  for (const pronouncedSurface of generatePronouncedGivenSurfaceVariants(givenUnits)) {
    const pronouncedCombos = buildKanaGivenCombosForUnits(pronouncedSurface.units);
    for (const combo of pronouncedCombos) {
      const normalizedParts = normalizeKanaPartsForJoin(combo.parts || [], pronouncedSurface.units);
      for (const surface of generateLiaisonKanaVariants(normalizedParts, pronouncedSurface.units)) {
        add(surface.text, combo.score * surface.scoreScale * pronouncedSurface.scoreScale);
      }
    }
  }
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([text, score]) => ({ text, score }));
}

function generateSurnameKanaOutputs(hangul) {
  const surnameData = state.runtime?.surnameByHangul?.get(hangul);
  return (surnameData?.kana || [])
    .slice(0, 8)
    .map((item) => ({ text: item.text, score: Number(item.score) || 0 }));
}

function surnameHanjaEntriesForOutput(hangul, surnameData) {
  const seen = new Set();
  const entries = [];
  for (const item of surnameData?.hanjaEntries || []) {
    if (!item.text || seen.has(item.text)) continue;
    seen.add(item.text);
    entries.push({
      text: item.text,
      score: Number(item.percent ?? item.count ?? 0),
      percent: item.percent != null ? Number(item.percent) : null,
      surnameKey: `${hangul}|${item.text}`,
    });
  }
  for (const item of surnameData?.hanjaCompatibilityEntries || []) {
    if (!item.text || seen.has(item.text)) continue;
    seen.add(item.text);
    entries.push({
      text: item.text,
      score: Number(item.score ?? item.count ?? 1),
      percent: null,
      surnameKey: item.sourceKey || `${hangul}|${item.text}`,
    });
  }
  return entries;
}

function generateSurnameHanjaOutputs(hangul) {
  const surnameData = state.runtime?.surnameByHangul?.get(hangul);
  const entries = surnameHanjaEntriesForOutput(hangul, surnameData);
  if (entries.length) {
    return entries.slice(0, 6);
  }
  return (surnameData?.hanja || [])
    .slice(0, 6)
    .map((text) => ({ text, score: 1, surnameKey: `${hangul}|${text}` }));
}

function mergeVariantOutputs(groups, keyForText = (text) => text) {
  const merged = new Map();
  for (const item of groups.flat()) {
    if (!item?.text) continue;
    const key = keyForText(item.text);
    const existing = merged.get(key);
    if (!existing || Number(item.score || 0) > Number(existing.score || 0)) {
      merged.set(key, item);
    }
  }
  return [...merged.values()]
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 8);
}

function generateOutputsForCandidate(candidate, exactRows) {
  const roleKinds = candidateRoleKinds(candidate);
  if (roleKinds.has("surname") && roleKinds.has("given")) {
    return {
      romanOutputs: mergeVariantOutputs([
        generateGivenRomanOutputs(candidate.hangul),
        generateSurnameRomanOutputs(candidate.hangul),
      ], normalizeLatin),
      kanaOutputs: mergeVariantOutputs([
        generateGivenKanaOutputs(candidate.hangul),
        generateSurnameKanaOutputs(candidate.hangul),
      ]),
      hanjaOutputs: generateSurnameHanjaOutputs(candidate.hangul),
    };
  }
  if (candidate.kind === "surname") {
    return {
      romanOutputs: generateSurnameRomanOutputs(candidate.hangul),
      kanaOutputs: generateSurnameKanaOutputs(candidate.hangul),
      hanjaOutputs: generateSurnameHanjaOutputs(candidate.hangul),
    };
  }
  if (candidate.kind === "given") {
    return {
      romanOutputs: generateGivenRomanOutputs(candidate.hangul),
      kanaOutputs: generateGivenKanaOutputs(candidate.hangul),
      hanjaOutputs: [],
    };
  }
  return {
    romanOutputs: generateRomanOutputs(candidate.hangul, exactRows),
    kanaOutputs: generateKanaOutputs(candidate.hangul, exactRows),
    hanjaOutputs: hanjaOutputsForCandidate(candidate.hangul, exactRows),
  };
}

function candidateSubtitle(candidate, exactRows) {
  const evidence = exactRows.length
    ? t("supportingRows", { count: exactRows.length })
    : candidate.kind === "given"
      ? t("generatedGivenEvidence")
      : "";
  const roleKinds = candidateRoleKinds(candidate);
  if (roleKinds.has("surname") && roleKinds.has("given")) {
    const surnameData = state.runtime?.surnameByHangul?.get(candidate.hangul);
    return t("ambiguousStandaloneSubtitle", {
      count: candidate.hangul.length,
      population: formatNumber(surnameData?.population || 0),
    });
  }
  if (candidate.kind === "surname") {
    const surnameData = state.runtime?.surnameByHangul?.get(candidate.hangul);
    return t("surnameSubtitle", {
      population: formatNumber(surnameData?.population || 0),
      evidence: t("supportingRows", { count: exactRows.length }),
    });
  }
  if (candidate.kind === "given") {
    return t("givenSubtitle", { count: candidate.hangul.length, evidence });
  }
  const { surname, given } = splitNameUnits(candidate.hangul, state.runtime.compoundSurnames);
  return t("fullSubtitle", { surname, given: given || "—", evidence });
}

function deriveInterpretationText(query, candidateMap) {
  const candidates = [...candidateMap.values()].sort((a, b) => b.score - a.score);
  if (!candidates.length) return t("interpretationNone");
  const topScore = Number(candidates[0].score) || 0;
  const activeKinds = [...new Set(
    candidates
      .filter((candidate) => Number(candidate.score) >= topScore * 0.7)
      .slice(0, 5)
      .flatMap((candidate) => [...candidateRoleKinds(candidate)]),
  )];
  if (!activeKinds.length) {
    return t("interpretationNone");
  }
  if (activeKinds.length === 1) {
    return t("interpretationLikely", { kind: candidateKindLabel(activeKinds[0]) });
  }
  return t("interpretationAmbiguous", {
    kinds: activeKinds.map(candidateKindLabel).join(state.language === "en" ? ", " : "、"),
  });
}

function generateRomanOutputs(hangul, exactRows) {
  const { surname, given } = splitNameUnits(hangul, state.runtime.compoundSurnames);
  const surnameData = state.runtime.surnameByHangul.get(surname);
  const givenUnits = Array.from(given);
  const counter = new Map();

  const add = (text, score) => {
    if (!text) return;
    counter.set(text, Math.max(score, counter.get(text) || 0));
  };

  for (const row of exactRows) {
    for (const item of row.romanizations || []) add(item.text, Number(item.score) + Number(row.weight || 0));
  }
  const surnameVariants = (surnameData?.latin || [{ text: surname, score: 1 }]).slice(0, 5);
  let givenCombos = [{ text: "", score: 0, parts: [] }];
  for (const [syllableIndex, syllable] of givenUnits.entries()) {
    const syllableData = state.data.syllables[syllable];
    let variants = modernGivenRomanVariantsForOutput(syllable, syllableData?.latin || [{ text: syllable, score: 1 }]).slice(0, 4);
    if (syllable === "이" && syllableIndex > 0) {
      const filtered = variants.filter((variant) => normalizeLatin(variant.text) !== "lee");
      if (filtered.length) variants = filtered;
    }
    const next = [];
    for (const combo of givenCombos) {
      for (const variant of variants) {
        next.push({
          text: `${combo.text}${variant.text}`,
          score: combo.score + Number(variant.score),
          parts: combo.parts.concat(variant.text),
        });
      }
    }
    givenCombos = next.sort((a, b) => b.score - a.score).slice(0, 18);
  }

  for (const surnameVariant of surnameVariants) {
    for (const givenCombo of givenCombos) {
      if (!givenCombo.parts.length) continue;
      const spaced = `${surnameVariant.text} ${givenCombo.parts.join(" ")}`;
      add(spaced, Number(surnameVariant.score) + givenCombo.score * 0.74);
      add(`${surnameVariant.text} ${givenCombo.parts.join("-")}`, Number(surnameVariant.score) + givenCombo.score);
      add(`${surnameVariant.text} ${givenCombo.text}`, Number(surnameVariant.score) + givenCombo.score * 0.9);
    }
  }

  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([text, score]) => ({ text, score }));
}

function generateKanaOutputs(hangul, exactRows) {
  const counter = new Map();
  const add = (text, score) => {
    if (!text) return;
    if (isBlockedJapaneseKanaSurface(text)) return;
    counter.set(text, Math.max(score, counter.get(text) || 0));
  };
  for (const row of exactRows) {
    for (const item of row.kana || []) add(item.text, Number(item.score) + Number(row.weight || 0));
  }
  const { surname, given } = splitNameUnits(hangul, state.runtime.compoundSurnames);
  const surnameData = state.runtime.surnameByHangul.get(surname);
  const surnameKana = surnameData?.kana || [];
  for (const surnameVariant of surnameKana.slice(0, 6)) {
    const surnameSurface = normalizeKanaJoinPart(surnameVariant.text, surname, true);
    for (const item of ATTESTED_CHRISTIAN_GIVEN_KANA.get(given) || []) {
      add(`${surnameSurface} ${item.text}`.trim(), Number(surnameVariant.score) + Number(item.score || 0));
    }
  }
  if (!surnameKana.length) {
    return [...counter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([text, score]) => ({ text, score }));
  }

  const givenUnits = Array.from(given);
  const givenCombos = buildKanaGivenCombosForUnits(givenUnits);

  if (givenCombos.length) {
    for (const surnameVariant of surnameKana.slice(0, 6)) {
      const surnameSurface = normalizeKanaJoinPart(surnameVariant.text, surname, true);
      for (const givenCombo of givenCombos) {
        const normalizedParts = normalizeKanaPartsForJoin(givenCombo.parts || [], givenUnits);
        for (const surface of generateLiaisonKanaVariants(normalizedParts, givenUnits)) {
          add(`${surnameSurface} ${surface.text}`.trim(), (Number(surnameVariant.score) + givenCombo.score) * surface.scoreScale);
        }
        for (const voicedSurface of generateVoicedGiyeokKanaVariants(normalizedParts, givenUnits)) {
          add(
            `${surnameSurface} ${voicedSurface.parts.join("")}`.trim(),
            (Number(surnameVariant.score) + givenCombo.score) * voicedSurface.scoreScale,
          );
        }
        for (const nasalSurface of generateStopNasalKanaVariants(normalizedParts, givenUnits)) {
          add(
            `${surnameSurface} ${nasalSurface.parts.join("")}`.trim(),
            (Number(surnameVariant.score) + givenCombo.score) * nasalSurface.scoreScale,
          );
        }
        for (const sokuonSurface of generateSokuonGeminateKanaVariants(normalizedParts, givenUnits)) {
          add(
            `${surnameSurface} ${sokuonSurface.parts.join("")}`.trim(),
            (Number(surnameVariant.score) + givenCombo.score) * sokuonSurface.scoreScale,
          );
        }
      }
    }
  }

  for (const pronouncedSurface of generatePronouncedGivenSurfaceVariants(givenUnits)) {
    const pronouncedCombos = buildKanaGivenCombosForUnits(pronouncedSurface.units);
    if (!pronouncedCombos.length) continue;
    for (const surnameVariant of surnameKana.slice(0, 6)) {
      const surnameSurface = normalizeKanaJoinPart(surnameVariant.text, surname, true);
      for (const givenCombo of pronouncedCombos) {
        const normalizedParts = normalizeKanaPartsForJoin(givenCombo.parts || [], pronouncedSurface.units);
        for (const surface of generateLiaisonKanaVariants(normalizedParts, pronouncedSurface.units)) {
          add(
            `${surnameSurface} ${surface.text}`.trim(),
            (Number(surnameVariant.score) + givenCombo.score) * surface.scoreScale * pronouncedSurface.scoreScale,
          );
        }
      }
    }
  }

  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([text, score]) => ({ text, score }));
}

function surnameKeyForHanjaOutput(hangul, hanjaText) {
  const { surname } = splitNameUnits(hangul, state.runtime.compoundSurnames);
  const surnameLength = Array.from(surname).length;
  const hanjaCharacters = Array.from(String(hanjaText || "")).filter((character) =>
    /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(character),
  );
  if (!surname || hanjaCharacters.length < surnameLength) return "";
  return `${surname}|${hanjaCharacters.slice(0, surnameLength).join("")}`;
}

function hanjaOutputsForCandidate(hangul, exactRows) {
  const counter = new Map();
  for (const row of exactRows) {
    if (!row.hanja) continue;
    const score = Number(row.weight || 0) + 5;
    const existing = counter.get(row.hanja);
    if (!existing || score > existing.score) {
      counter.set(row.hanja, {
        score,
        surnameKey: surnameKeyForHanjaOutput(hangul, row.hanja),
      });
    }
  }
  if (!counter.size) {
    const { surname } = splitNameUnits(hangul, state.runtime.compoundSurnames);
    const surnameData = state.runtime.surnameByHangul.get(surname);
    const hanjaEntries = surnameHanjaEntriesForOutput(surname, surnameData);
    if (hanjaEntries.length) {
      return hanjaEntries.slice(0, 6).map((item) => ({
        text: `${item.text} …`,
        score: Number(item.score || 0),
        percent: item.percent,
        surnameKey: item.surnameKey,
      }));
    }
    for (const hanja of surnameData?.hanja || []) {
      counter.set(`${hanja} …`, { score: 1.2, surnameKey: `${surname}|${hanja}` });
    }
  }
  return [...counter.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 6)
    .map(([text, item]) => ({ text, score: item.score, surnameKey: item.surnameKey }));
}

function populateResultCards(candidateMap) {
  const candidates = [...candidateMap.values()].sort((a, b) => candidateRankingScore(b) - candidateRankingScore(a)).slice(0, 16);
  if (!candidates.length) {
    resultsEl.innerHTML = `<div class="empty-state" role="status">${t("noMatches")}</div>`;
    return;
  }

  const candidatePercents = allocatePercentages(candidates, (candidate) => candidateRankingScore(candidate), { minPositive: 1 });
  resultsEl.innerHTML = "";
  for (const [index, candidate] of candidates.entries()) {
    const exactRows = gatherExactRowsForHangul(candidate.hangul, candidate);
    const { romanOutputs, kanaOutputs, hanjaOutputs } = generateOutputsForCandidate(candidate, exactRows);
    const plausibility = candidatePercents[index] ?? 0;

    const fragment = resultTemplate.content.cloneNode(true);
    fragment.querySelector(".result-hangul").textContent = candidate.hangul;
    const pronunciationButton = fragment.querySelector(".pronunciation-button");
    const pronunciationLabel = fragment.querySelector(".pronunciation-label");
    if (pronunciationButton && pronunciationLabel) {
      const pronunciationText = candidate.hangul;
      const pronunciationLabelText = t("pronunciationAria", { name: pronunciationText });
      pronunciationButton.dataset.name = pronunciationText;
      pronunciationButton.dataset.state = "idle";
      pronunciationButton.setAttribute("aria-label", pronunciationLabelText);
      pronunciationButton.title = t("playPronunciation");
      pronunciationLabel.textContent = pronunciationLabelText;
      if (supportsAudioPlayback() || supportsSpeechSynthesis()) {
        pronunciationButton.addEventListener("click", () => playKoreanPronunciation(pronunciationText, pronunciationButton));
      } else {
        pronunciationButton.disabled = true;
        pronunciationButton.dataset.state = "unavailable";
        pronunciationButton.title = t("pronunciationUnavailable");
      }
    }
    fragment.querySelector(".result-subtitle").textContent = candidateSubtitle(candidate, exactRows);
    fragment.querySelector(".score-value").textContent = `${plausibility}%`;
    fragment.querySelector(".score-bar span").style.width = `${plausibility}%`;

    const romanList = fragment.querySelector(".roman-list");
    const kanaList = fragment.querySelector(".kana-list");
    const hanjaList = fragment.querySelector(".hanja-list");
    fillVariantList(romanList, romanOutputs);
    fillVariantList(kanaList, kanaOutputs);
    fillHanjaVariantList(hanjaList, hanjaOutputs, !hanjaOutputs.length ? t("noHanjaObserved") : "", candidate.hangul);

    resultsEl.appendChild(fragment);
  }
}

function buildResultCards(candidateMap) {
  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const shouldSwapVisibleResults =
    !reducedMotion &&
    resultsSectionEl.classList.contains("is-visible") &&
    !resultsSectionEl.classList.contains("is-hidden");

  if (resultsSwapTimerId) {
    window.clearTimeout(resultsSwapTimerId);
    resultsSwapTimerId = null;
  }

  const renderAndReveal = (options = {}) => {
    populateResultCards(candidateMap);
    showResultsSection(options);
  };

  if (!shouldSwapVisibleResults) {
    renderAndReveal();
    return;
  }

  resultsSectionEl.classList.remove("is-entering", "is-visible");
  resultsSectionEl.classList.add("is-exiting");
  resultsSectionEl.setAttribute("aria-hidden", "true");
  resultsSwapTimerId = window.setTimeout(() => {
    resultsSwapTimerId = null;
    resultsSectionEl.classList.remove("is-exiting");
    renderAndReveal({ delay: false });
  }, RESULTS_SWAP_FADE_MS);
}

function pruneImplausibleCandidates(candidateMap) {
  const candidates = [...candidateMap.values()].sort((a, b) => b.score - a.score);
  if (!candidates.length) return candidateMap;
  const bestStandaloneGiven = candidates.find((candidate) => {
    if (candidate.kind !== "given") return false;
    if (isLikelyFullNameMisparsedAsGiven(candidate, candidateMap)) return false;
    const units = candidateGivenUnits(candidate);
    return units.length <= 2 || hasSupportedWholeGivenName(units);
  });
  const bestStandaloneGivenUnits = bestStandaloneGiven ? candidateGivenUnits(bestStandaloneGiven) : [];
  const bestStandaloneGivenWholeSupported = bestStandaloneGiven ? hasSupportedWholeGivenName(bestStandaloneGivenUnits) : false;
  const bestStandaloneCompactGiven =
    bestStandaloneGiven &&
    bestStandaloneGivenWholeSupported &&
    bestStandaloneGivenUnits.length <= 2
      ? bestStandaloneGiven
      : null;

  const bestAllowed = candidates.find((candidate) => {
    if (candidate.kind === "surname") return true;
    return candidateGivenUnits(candidate).every((syllable) => isAllowedNameSyllable(syllable));
  });

  const bestPlausible = candidates.find((candidate) => {
    const units = candidateGivenUnits(candidate);
    if (candidate.kind === "surname") return true;
    return units.length && units.every((syllable) => !isUltraRareGivenSyllable(syllable));
  });
  const plausibilityBaseline = bestPlausible || bestAllowed || candidates[0];
  if (!plausibilityBaseline) return candidateMap;

  const filtered = new Map();
  for (const candidate of candidates) {
    if (isLikelyFullNameMisparsedAsGiven(candidate, candidateMap)) continue;
    const units = candidateGivenUnits(candidate);
    if (
      state.queryMeta?.explicitMedialRomanLateralCue &&
      candidate.kind === "given" &&
      units.length === 2
    ) {
      const secondParts = decomposeHangulSyllable(units[1]);
      if (secondParts && DUUM_RECOVERY_VOWELS.has(secondParts.vowel)) {
        if (secondParts.onset === "ㄹ" && isPlausibleRecoveredDuumSyllable(units[1])) {
          candidate.score += 1800;
        } else if (secondParts.onset === "ㅇ") {
          candidate.score -= 1200;
        }
      }
    }
    const ultraRareCount = units.filter((syllable) => isUltraRareGivenSyllable(syllable)).length;
    const unsupportedCount = units.filter((syllable) => !isAllowedNameSyllable(syllable)).length;
    const unsupportedLongGiven = candidate.kind !== "surname" && units.length >= 3 && !hasSupportedWholeGivenName(units);
    const hasExactEvidence = hasCandidateExactEvidence(candidate);
    if (!hasExactEvidence && !isNameLikeCandidate(candidate)) continue;
    const kanaDerivedOnly = !hasExactEvidence && [...candidate.evidence].some((item) => /Kana/.test(item));
    const singleRomanSyntheticFull =
      state.queryMeta?.isSingleRomanToken &&
      candidate.kind === "full" &&
      !hasExactEvidence &&
      [...candidate.evidence].every((item) => /Latin (joined-string|suffix-surname) parse/.test(item));
    const { surname } = candidate.kind === "full"
      ? splitNameUnits(candidate.hangul, state.runtime?.compoundSurnames)
      : { surname: "" };
    const surnamePopulation = Number(state.runtime?.surnameByHangul?.get(surname)?.population || 0);
    const nonSinoLikeGivenCount = units.filter((syllable) => !isSinoLikeGivenSyllable(syllable)).length;
    if (
      singleRomanSyntheticFull &&
      bestStandaloneCompactGiven &&
      surnamePopulation < 50000 &&
      candidate.score <= bestStandaloneCompactGiven.score * 1.4
    ) {
      continue;
    }
    if (
      singleRomanSyntheticFull &&
      bestStandaloneGiven &&
      bestStandaloneGivenWholeSupported &&
      nonSinoLikeGivenCount > 0
    ) {
      continue;
    }
    if (
      singleRomanSyntheticFull &&
      bestStandaloneGiven &&
      bestStandaloneGivenWholeSupported
    ) {
      const candidateWholeSupported = hasSupportedWholeGivenName(units);
      const unitDelta = Math.max(0, units.length - bestStandaloneGivenUnits.length);
      let singleTokenPenalty = 120 + Math.min(120, givenWholeNamePrior(bestStandaloneGivenUnits) * 0.16);
      if (!candidateWholeSupported) singleTokenPenalty += 140;
      if (nonSinoLikeGivenCount) singleTokenPenalty += 220 * nonSinoLikeGivenCount;
      if (unitDelta) singleTokenPenalty += unitDelta * 90;
      candidate.score -= singleTokenPenalty;
    }
    if (!hasExactEvidence && unsupportedLongGiven) continue;
    if (
      singleRomanSyntheticFull &&
      bestStandaloneGiven &&
      candidate.score < bestStandaloneGiven.score * (nonSinoLikeGivenCount ? 1.35 : 1.12)
    ) {
      continue;
    }
    if (!hasExactEvidence && bestAllowed && unsupportedCount >= 1 && !hasSupportedWholeGivenName(units)) continue;
    if (
      kanaDerivedOnly &&
      unsupportedCount === 0 &&
      ultraRareCount <= 1 &&
      candidate.score >= plausibilityBaseline.score * 0.12
    ) {
      filtered.set(candidateKey(candidate.hangul, candidate.kind), candidate);
      continue;
    }
    if (!hasExactEvidence && ultraRareCount >= 2 && candidate.score < plausibilityBaseline.score * 0.45) continue;
    if (!hasExactEvidence && ultraRareCount >= 1 && candidate.score < plausibilityBaseline.score * 0.28) continue;
    filtered.set(candidateKey(candidate.hangul, candidate.kind), candidate);
  }
  return filtered;
}

function allocatePercentages(items, getWeight = (item) => Number(item.score) || 0, options = {}) {
  if (!items.length) return [];
  const rawWeights = items.map((item) => Math.max(0, getWeight(item)));
  const total = rawWeights.reduce((sum, weight) => sum + weight, 0);
  const normalized = total > 0 ? rawWeights.map((weight) => (weight / total) * 100) : items.map(() => 100 / items.length);
  const base = normalized.map((value) => Math.floor(value));
  let remainder = 100 - base.reduce((sum, value) => sum + value, 0);
  const rankedRemainders = normalized
    .map((value, index) => ({ index, remainder: value - base[index], weight: rawWeights[index] }))
    .sort((a, b) => b.remainder - a.remainder || b.weight - a.weight || a.index - b.index);
  for (let i = 0; i < rankedRemainders.length && remainder > 0; i += 1) {
    base[rankedRemainders[i].index] += 1;
    remainder -= 1;
  }
  const minPositive = Math.max(0, Math.floor(Number(options.minPositive || 0)));
  const positiveIndices = rawWeights
    .map((weight, index) => (weight > 0 ? index : -1))
    .filter((index) => index >= 0);
  if (minPositive > 0 && positiveIndices.length > 1 && positiveIndices.length * minPositive <= 100) {
    let needed = 0;
    for (const index of positiveIndices) {
      if (base[index] >= minPositive) continue;
      needed += minPositive - base[index];
      base[index] = minPositive;
    }
    while (needed > 0) {
      const donor = positiveIndices
        .filter((index) => base[index] > minPositive)
        .sort((a, b) => base[b] - base[a] || rawWeights[b] - rawWeights[a] || a - b)[0];
      if (donor == null) break;
      base[donor] -= 1;
      needed -= 1;
    }
  }
  return base;
}

function fillVariantList(listEl, items, emptyText = t("noOutput")) {
  listEl.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = emptyText;
    listEl.appendChild(li);
    return;
  }
  const computedPercents = items.some((item) => item.percent != null) ? [] : allocatePercentages(items, (item) => Number(item.score) || 0);
  for (const [index, item] of items.entries()) {
    const li = document.createElement("li");
    if (listEl.classList.contains("kana-list")) {
      const rank = document.createElement("span");
      rank.className = "variant-rank";
      rank.textContent = `${index + 1}.`;
      li.appendChild(rank);
    }
    const value = document.createElement("span");
    value.textContent = item.text;
    const score = document.createElement("span");
    score.className = "variant-score";
    const percent = item.percent != null ? item.percent.toFixed(2) : computedPercents.shift();
    score.textContent = ` ${percent}%`;
    li.append(value, score);
    listEl.appendChild(li);
  }
}

function localizedBonGwanName(clan) {
  if (clan.otherCombined) return t("bonGwanOther");
  if (state.language === "en") return clan.name;
  return clan.hanja || clan.name;
}

function givenHanjaForHangnyeol(hanjaText, candidateHangul) {
  const { surname, given } = splitNameUnits(candidateHangul, state.runtime.compoundSurnames);
  const characters = Array.from(extractHanja(hanjaText));
  const surnameLength = Array.from(surname).length;
  const givenLength = Array.from(given).length;
  if (characters.length < surnameLength + givenLength) return "";
  return characters.slice(surnameLength, surnameLength + givenLength).join("");
}

function hangnyeolMatchesForCandidate(candidateHangul, record, hanjaText) {
  const { surname, given } = splitNameUnits(candidateHangul, state.runtime.compoundSurnames);
  const queryHanja = extractHanja(queryEl?.value || state.hangnyeolQueryHanja);
  const queryHanjaCharacters = Array.from(queryHanja);
  const surnameLength = Array.from(surname).length;
  const givenLength = Array.from(given).length;
  const querySurnameHanja = queryHanjaCharacters.slice(0, surnameLength).join("");
  const knownGivenHanja = querySurnameHanja === String(record.hanja || "").trim() && queryHanjaCharacters.length >= surnameLength + givenLength
    ? queryHanjaCharacters.slice(surnameLength, surnameLength + givenLength).join("")
    : givenHanjaForHangnyeol(hanjaText, candidateHangul);
  const displayedClanIds = new Set((record.clans || []).map((clan) => clanIdForHangnyeol({
    surnameHangul: record.hangul,
    surnameHanja: record.hanja,
    bonGwanName: clan.name,
    bonGwanHanja: clan.hanja,
  })));
  return findHangnyeolMatches(state.hangnyeolData, {
    surnameHangul: surname,
    surnameHanja: record.hanja,
    givenNameHangul: given,
    givenNameHanja: knownGivenHanja,
  }).filter((match) => displayedClanIds.has(match.clanId));
}

function hangnyeolMatchLabel(matches) {
  if (matches.some((match) => match.evidenceType === "exact_hanja")) return t("hangnyeolExactMatch");
  const branch = matches.find((match) => match.branchName)?.branchName;
  return branch ? t("hangnyeolMatchWithinBranch", { branch }) : t("hangnyeolPossibleMatch");
}

function hangnyeolMatchSummary(matches) {
  const key = matches.length && matches.every((match) => match.evidenceType === "exact_hanja")
    ? "hangnyeolExactMatchCount"
    : "hangnyeolMatchCount";
  return t(key, { count: matches.length });
}

function buildHangnyeolExplanation(match, given, record, clan) {
  const explanation = document.createElement("section");
  explanation.className = "hangnyeol-explanation";

  const title = document.createElement("h5");
  title.textContent = match.evidenceType === "exact_hanja" ? t("hangnyeolExactMatch") : t("hangnyeolPossibleMatch");
  explanation.appendChild(title);

  const clanLine = document.createElement("p");
  clanLine.className = "hangnyeol-clan";
  clanLine.textContent = t("hangnyeolClan", {
    clan: localizedBonGwanName(clan),
    surname: record.hanja,
  });
  explanation.appendChild(clanLine);

  const metadata = document.createElement("p");
  metadata.className = "hangnyeol-metadata";
  metadata.textContent = [
    match.branchName ? match.branchName : "",
    match.generation ? t("hangnyeolGeneration", { generation: match.generation }) : "",
  ].filter(Boolean).join(" · ");
  if (metadata.textContent) explanation.appendChild(metadata);

  const patternLabel = document.createElement("h6");
  patternLabel.textContent = t("hangnyeolPublishedPattern");
  const pattern = document.createElement("p");
  pattern.className = "hangnyeol-pattern";
  pattern.textContent = [match.patternHanja, match.patternHangul].filter(Boolean).join(" · ");
  explanation.append(patternLabel, pattern);

  const whyLabel = document.createElement("h6");
  whyLabel.textContent = t("hangnyeolWhyItMatches");
  const why = document.createElement("p");
  why.textContent = match.matchedPosition === "given_second"
    ? t("hangnyeolSecondPositionMatch", { given, character: match.matchedCharacterHangul })
    : t("hangnyeolFirstPositionMatch", { given, character: match.matchedCharacterHangul });
  const evidence = document.createElement("p");
  evidence.className = "hangnyeol-evidence";
  evidence.textContent = match.evidenceType === "exact_hanja" ? t("hangnyeolExactHanjaReason") : t("hangnyeolReadingReason");
  const strengthLabel = document.createElement("h6");
  strengthLabel.textContent = t("hangnyeolMatchStrength");
  const strength = document.createElement("p");
  strength.className = "hangnyeol-strength";
  strength.textContent = match.evidenceType === "exact_hanja" ? t("hangnyeolStrengthExact") : t("hangnyeolStrengthPossible");
  explanation.append(whyLabel, why, evidence, strengthLabel, strength);

  const sources = sourceRecordsForHangnyeolMatch(state.hangnyeolData, match);
  if (sources.length) {
    const sourceLabel = document.createElement("h6");
    sourceLabel.textContent = t("hangnyeolSource");
    const source = document.createElement("a");
    source.className = "hangnyeol-source";
    source.href = sources[0].url;
    source.target = "_blank";
    source.rel = "noreferrer";
    source.textContent = sources[0].title;
    explanation.append(sourceLabel, source);
  }

  const limitation = document.createElement("p");
  limitation.className = "hangnyeol-limit";
  limitation.textContent = t("hangnyeolLimit");
  explanation.appendChild(limitation);
  return explanation;
}

function populateBonGwanPanel(details, record, matches, candidateHangul) {
  if (details.dataset.hydrated === "true") return;
  details.dataset.hydrated = "true";
  const meta = state.bonGwanData?.meta || {};
  const year = Number(meta.year || 2015);
  const surname = `${record.hangul}(${record.hanja})`;

  const panel = document.createElement("div");
  panel.className = "bon-gwan-panel";

  const scope = document.createElement("p");
  scope.className = "bon-gwan-scope";
  scope.textContent = t("bonGwanScope", {
    surname,
    population: formatNumber(record.total),
    year,
  });
  panel.appendChild(scope);

  const columnLabels = document.createElement("div");
  columnLabels.className = "bon-gwan-columns";
  for (const [className, key] of [
    ["bon-gwan-column-name", "bonGwanNameLabel"],
    ["bon-gwan-column-share", "bonGwanShareLabel"],
    ["bon-gwan-column-count", "bonGwanPeopleLabel"],
  ]) {
    const label = document.createElement("span");
    label.className = className;
    label.textContent = t(key);
    columnLabels.appendChild(label);
  }
  panel.appendChild(columnLabels);

  const matchesByClanId = new Map();
  for (const match of matches || []) {
    const clanMatches = matchesByClanId.get(match.clanId) || [];
    clanMatches.push(match);
    matchesByClanId.set(match.clanId, clanMatches);
  }

  const list = document.createElement("ul");
  list.className = "bon-gwan-list";
  list.tabIndex = 0;
  list.setAttribute("aria-label", t("bonGwanDistribution"));
  for (const [index, clan] of (record.clans || []).entries()) {
    const row = document.createElement("li");
    const main = document.createElement("div");
    main.className = "bon-gwan-row";
    const nameWrap = document.createElement("div");
    nameWrap.className = "bon-gwan-name-wrap";
    const name = document.createElement("span");
    const share = document.createElement("span");
    const count = document.createElement("span");
    name.className = "bon-gwan-name";
    share.className = "bon-gwan-share";
    count.className = "bon-gwan-count";
    name.textContent = localizedBonGwanName(clan);
    share.textContent = `${formatPercentRatio(clan.count, record.total)}%`;
    count.textContent = formatNumber(clan.count);
    nameWrap.appendChild(name);
    main.append(nameWrap, share, count);
    row.appendChild(main);

    const clanMatches = matchesByClanId.get(clanIdForHangnyeol({
      surnameHangul: record.hangul,
      surnameHanja: record.hanja,
      bonGwanName: clan.name,
      bonGwanHanja: clan.hanja,
    })) || [];
    if (clanMatches.length) {
      row.classList.add("has-hangnyeol-match");
      const panelId = `hangnyeol-${record.hangul}-${record.hanja}-${index}`;
      const badge = document.createElement("button");
      badge.type = "button";
      badge.className = "hangnyeol-match-badge";
      badge.textContent = hangnyeolMatchLabel(clanMatches);
      badge.setAttribute("aria-expanded", "false");
      badge.setAttribute("aria-controls", panelId);
      nameWrap.appendChild(badge);

      const disclosure = document.createElement("div");
      disclosure.className = "hangnyeol-match-panel";
      disclosure.id = panelId;
      disclosure.hidden = true;
      for (const match of clanMatches) disclosure.appendChild(buildHangnyeolExplanation(match, splitNameUnits(candidateHangul, state.runtime.compoundSurnames).given, record, clan));
      badge.addEventListener("click", () => {
        const isOpen = disclosure.hidden;
        disclosure.hidden = !isOpen;
        badge.setAttribute("aria-expanded", String(isOpen));
        list.classList.toggle("has-open-hangnyeol-panel", [...list.querySelectorAll(".hangnyeol-match-panel")].some((panel) => !panel.hidden));
      });
      row.appendChild(disclosure);
    }
    list.appendChild(row);
  }
  panel.appendChild(list);

  if ((record.clans || []).some((clan) => clan.otherCombined)) {
    const note = document.createElement("p");
    note.className = "bon-gwan-note";
    note.textContent = t("bonGwanCombinedNote");
    panel.appendChild(note);
  }

  if (meta.sourceUrl) {
    const source = document.createElement("a");
    source.className = "bon-gwan-source";
    source.href = meta.sourceUrl;
    source.target = "_blank";
    source.rel = "noreferrer";
    source.textContent = t("bonGwanSource", { year });
    panel.appendChild(source);
  }
  details.appendChild(panel);
}

function fillHanjaVariantList(listEl, items, emptyText = t("noHanjaObserved"), candidateHangul = "") {
  listEl.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = emptyText;
    listEl.appendChild(li);
    return;
  }
  const computedPercents = items.some((item) => item.percent != null)
    ? []
    : allocatePercentages(items, (item) => Number(item.score) || 0);
  for (const item of items) {
    const li = document.createElement("li");
    li.className = "hanja-variant-item";
    const variant = document.createElement("div");
    variant.className = "hanja-variant-main";
    const value = document.createElement("span");
    value.textContent = item.text;
    const score = document.createElement("span");
    score.className = "variant-score";
    if (item.percent != null) {
      score.textContent = ` ${item.percent.toFixed(2)}%`;
    } else if (computedPercents.length) {
      score.textContent = ` ${computedPercents.shift()}%`;
    }
    variant.append(value, score);
    li.appendChild(variant);

    const record = item.surnameKey ? state.bonGwanData?.surnames?.[item.surnameKey] : null;
    if (record?.clans?.length) {
      const matches = hangnyeolMatchesForCandidate(candidateHangul, record, item.text);
      const details = document.createElement("details");
      details.className = "bon-gwan-disclosure";
      const summary = document.createElement("summary");
      const label = document.createElement("span");
      const count = document.createElement("span");
      const chevron = document.createElement("span");
      label.className = "bon-gwan-summary-label";
      count.className = "bon-gwan-summary-count";
      chevron.className = "bon-gwan-chevron";
      chevron.setAttribute("aria-hidden", "true");
      label.textContent = t("bonGwanDistribution");
      count.textContent = t("bonGwanEntryCount", { count: record.clans.length });
      if (matches.length) {
        const matchSummary = document.createElement("span");
        matchSummary.className = "bon-gwan-match-summary";
        matchSummary.textContent = hangnyeolMatchSummary(matches);
        summary.append(label, matchSummary, count, chevron);
      } else {
        summary.append(label, count, chevron);
      }
      details.appendChild(summary);
      details.addEventListener("toggle", () => {
        if (details.open) populateBonGwanPanel(details, record, matches, candidateHangul);
      });
      li.appendChild(details);
    }
    listEl.appendChild(li);
  }
}

function shuffled(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickRandom(items) {
  if (!items?.length) return null;
  return items[Math.floor(Math.random() * items.length)] || null;
}

function pickWeightedRandom(items, getWeight) {
  const weighted = (items || [])
    .map((item) => ({ item, weight: Math.max(0, Number(getWeight(item)) || 0) }))
    .filter((entry) => entry.weight > 0);
  if (!weighted.length) return pickRandom(items || []);
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.random() * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.item;
  }
  return weighted[weighted.length - 1].item;
}

function pickWeightedWithoutReplacement(items, count, getWeight) {
  const remaining = [...(items || [])];
  const picks = [];
  while (remaining.length && picks.length < count) {
    const picked = pickWeightedRandom(remaining, getWeight);
    if (!picked) break;
    picks.push(picked);
    remaining.splice(remaining.indexOf(picked), 1);
  }
  return picks;
}

function addExample(pool, seen, text, type) {
  const normalized = text?.trim();
  if (!normalized) return;
  if (type === "kana" && isBlockedJapaneseKanaSurface(normalized)) return;
  const key = `${type}:${normalized}`;
  if (seen.has(key)) return;
  if (!hasSearchableResultsForExample(normalized)) return;
  seen.add(key);
  pool.push({ text: normalized, type });
}

function buildTypewriterHanjaSurnameKeys(limit = TYPEWRITER_HANJA_SURNAME_LIMIT) {
  const ranked = [];
  for (const surname of state.data?.surnames || []) {
    for (const entry of surname.hanjaEntries || []) {
      const count = Number(entry.count || 0);
      const percent = Number(entry.percent || 0);
      if (!surname.hangul || !entry.text || count <= 0 || percent <= TYPEWRITER_HANJA_SURNAME_MIN_PERCENT) continue;
      ranked.push({
        key: `${surname.hangul}|${entry.text}`,
        count,
        percent,
        population: Number(surname.population || 0),
      });
    }
  }
  return new Set(
    ranked
      .sort((a, b) => b.count - a.count || b.percent - a.percent || b.population - a.population || a.key.localeCompare(b.key))
      .slice(0, limit)
      .map((item) => item.key),
  );
}

function surnameHanjaOptions(surnameData, allowedHanjaSurnameKeys = null) {
  const entries = (surnameData?.hanjaEntries || []).filter(
    (item) => item.text && (!allowedHanjaSurnameKeys || allowedHanjaSurnameKeys.has(`${surnameData.hangul}|${item.text}`)),
  );
  if (entries.length) {
    return entries.slice(0, 4).map((item) => ({
      text: item.text,
      score: 24 + Math.log1p(Number(item.count || item.percent || 1)) * 8,
    }));
  }
  if (allowedHanjaSurnameKeys) return [];
  return (surnameData?.hanja || []).slice(0, 4).map((text, index) => ({
    text,
    score: Math.max(1, 12 - index * 2),
  }));
}

function givenHanjaOptionsForSyllable(syllable, preferObserved = false) {
  const merged = new Map();
  const add = (character, score) => {
    if (!character) return;
    merged.set(character, Math.max(score, merged.get(character) || 0));
  };

  const modernUsageCharacters = (state.data?.hanjaUsageCharsByReading?.[syllable] || []).slice(0, 8);
  const supplementaryLimit = modernUsageCharacters.length ? 2 : 3;
  const observedNameCharacters = (state.data?.hanjaNameCharsByReading?.[syllable] || [])
    .filter((item) => Number(item.observedScore || 0) > 0)
    .sort((a, b) => Number(b.observedScore || 0) - Number(a.observedScore || 0))
    .slice(0, preferObserved ? 5 : supplementaryLimit);

  // Historical examples use observed name-character evidence before the modern usage prior.
  for (const item of modernUsageCharacters) {
    add(item.char, (preferObserved ? 32 : 64) + Math.log1p(Number(item.score || 0)) * (preferObserved ? 8 : 12));
  }
  for (const item of observedNameCharacters) {
    add(item.char, (preferObserved ? 72 : 28) + Math.log1p(Number(item.observedScore || 0)) * 10);
  }

  return [...merged.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([character, score]) => ({ character, score }));
}

function givenHanjaCandidates(given, preferObserved = false) {
  const counter = new Map();
  const add = (text, score) => {
    if (!text || Array.from(text).length !== Array.from(given).length) return;
    counter.set(text, Math.max(score, counter.get(text) || 0));
  };

  for (const item of state.data?.hanjaUsageGivenNames?.[given] || []) {
    add(item.hanja, (preferObserved ? 72 : 180) + Math.log1p(Number(item.score || 0)) * (preferObserved ? 9 : 14));
  }

  const givenUnits = Array.from(given);
  const hasRepeatHanjaEvidence = givenUnits.every(
    (syllable) => Number(state.data?.syllables?.[syllable]?.hanjaGivenCount || 0) >= 2,
  );
  if (!hasRepeatHanjaEvidence) {
    return [...counter.entries()].map(([text, score]) => ({ text, score }));
  }

  let combinations = [{ text: "", score: 0 }];
  for (const syllable of givenUnits) {
    const options = givenHanjaOptionsForSyllable(syllable, preferObserved);
    if (!options.length) return [...counter.entries()].map(([text, score]) => ({ text, score }));
    const next = [];
    for (const combination of combinations) {
      for (const option of options) {
        next.push({
          text: `${combination.text}${option.character}`,
          score: combination.score + option.score,
        });
      }
    }
    combinations = next.sort((a, b) => b.score - a.score).slice(0, 72);
  }
  for (const combination of combinations) add(combination.text, 48 + combination.score);

  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([text, score]) => ({ text, score }));
}

function generateHanjaExamplesForName(
  hangul,
  count = TYPEWRITER_HANJA_VARIANTS_PER_NAME,
  allowedHanjaSurnameKeys = null,
  preferObservedGivenHanja = false,
) {
  if (!hangul) return [];
  const { surname, given } = splitNameUnits(hangul, state.runtime.compoundSurnames);
  const surnameData = state.runtime.surnameByHangul.get(surname);
  const surnameOptions = surnameHanjaOptions(surnameData, allowedHanjaSurnameKeys);
  const givenOptions = givenHanjaCandidates(given, preferObservedGivenHanja);
  if (!surnameOptions.length || !givenOptions.length) return [];

  const candidates = [];
  for (const surnameOption of surnameOptions) {
    for (const givenOption of givenOptions) {
      candidates.push({
        text: `${surnameOption.text}${givenOption.text}`,
        score: surnameOption.score * 0.35 + givenOption.score,
      });
    }
  }
  return pickWeightedWithoutReplacement(
    candidates,
    count,
    (item) => Math.pow(Math.max(1, item.score), 1.45),
  ).map((item) => item.text);
}

function isLegacyGivenName(meta) {
  return String(meta?.periodsPresent || "")
    .split(";")
    .some((period) => LEGACY_GIVEN_NAME_PERIODS.has(period));
}

function buildGeneratedExampleNames() {
  const pool = [];
  const seen = new Set();
  const typewriterHanjaSurnameKeys = buildTypewriterHanjaSurnameKeys();
  const surnames = (state.data?.surnames || []).filter((item) => item.hangul && Number(item.population || 0) >= 50000);
  const givenNames = Object.entries(state.data?.givenNames || {})
    .map(([hangul, meta]) => ({
      hangul,
      meta,
      isLegacy: isLegacyGivenName(meta),
      weight: Number(meta?.totalWeight || 0) + Number(meta?.rowOccurrences || 0) * 25,
    }))
    .filter((item) => item.hangul && Array.from(item.hangul).length === 2 && item.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  if (!surnames.length || !givenNames.length) {
    return (state.data?.fullNames || [])
      .map((row) => row.hangul?.trim())
      .filter(Boolean)
      .map((hangul) => ({ hangul, givenRank: null }));
  }

  const highRankedGivenNames = givenNames.slice(0, 800);
  const broaderGivenNames = givenNames.slice(800, 2500);
  const legacyGivenNames = givenNames.filter((item) => item.isLegacy);
  const targetCount = Math.max(exampleChipEls.length * 32, 220);
  let attempts = 0;
  while (pool.length < targetCount && attempts < targetCount * 12) {
    attempts += 1;
    const surname = pickWeightedRandom(surnames, (item) => Math.log1p(Number(item.population || 0)));
    const sample = Math.random();
    const givenSource =
      sample < LEGACY_GIVEN_NAME_SAMPLE_SHARE && legacyGivenNames.length
        ? legacyGivenNames
        : sample < 0.82 || !broaderGivenNames.length
          ? highRankedGivenNames
          : broaderGivenNames;
    const given = pickWeightedRandom(givenSource, (item) => Math.log1p(item.weight));
    const hangul = `${surname?.hangul || ""}${given?.hangul || ""}`.trim();
    if (!hangul || seen.has(hangul)) continue;
    const romanOutputs = generateRomanOutputs(hangul, []);
    const kanaOutputs = generateKanaOutputs(hangul, []);
    if (!romanOutputs.length || !kanaOutputs.length) continue;
    seen.add(hangul);
    pool.push({
      hangul,
      givenRank: given?.rank || null,
      legacyGiven: Boolean(given?.isLegacy),
      roman: pickWeightedRandom(romanOutputs.slice(0, 4), (item) => Number(item.score) || 1)?.text,
      kana: pickWeightedRandom(kanaOutputs.slice(0, 4), (item) => Number(item.score) || 1)?.text?.replace(/\s+/g, "・"),
      hanja: "",
      hanjaVariants: [],
    });
  }

  const hanjaWeight = (item) => Math.log1p(Math.max(1, 1601 - Number(item.givenRank || 1600)));
  const legacyHanjaCandidates = pool.filter((item) => item.legacyGiven);
  const otherHanjaCandidates = pool.filter((item) => !item.legacyGiven && Number(item.givenRank || Infinity) <= 1600);
  const legacyHanjaSourceCount = Math.ceil(TYPEWRITER_HANJA_SOURCE_NAME_COUNT * LEGACY_HANJA_SOURCE_SHARE);
  const hanjaEligibleNames = [
    ...pickWeightedWithoutReplacement(legacyHanjaCandidates, legacyHanjaSourceCount, hanjaWeight),
    ...pickWeightedWithoutReplacement(otherHanjaCandidates, TYPEWRITER_HANJA_SOURCE_NAME_COUNT, hanjaWeight),
  ];
  let hanjaSourceNameCount = 0;
  for (const item of hanjaEligibleNames) {
    const variants = generateHanjaExamplesForName(
      item.hangul,
      TYPEWRITER_HANJA_VARIANTS_PER_NAME,
      typewriterHanjaSurnameKeys,
      item.legacyGiven,
    );
    if (!variants.length) continue;
    item.hanjaVariants = variants;
    item.hanja = variants[0];
    hanjaSourceNameCount += 1;
    if (hanjaSourceNameCount >= TYPEWRITER_HANJA_SOURCE_NAME_COUNT) break;
  }
  return pool;
}

function buildHangulExamplePool(generatedNames) {
  const pool = [];
  const seen = new Set();
  for (const item of generatedNames || []) {
    addExample(pool, seen, item.hangul, "hangul");
  }
  return pool;
}

function buildRomanExamplePool(generatedNames) {
  const pool = [];
  const seen = new Set();
  for (const item of generatedNames || []) {
    addExample(pool, seen, item.roman, "roman");
  }
  return pool;
}

function buildKanaExamplePool(generatedNames) {
  const pool = [];
  const seen = new Set();
  for (const item of generatedNames || []) {
    addExample(pool, seen, item.kana, "kana");
  }
  return pool;
}

function romanPromptFormats(text) {
  const normalized = text?.trim();
  if (!normalized) return [];
  const formats = [normalized];
  if (/\s/.test(normalized)) {
    formats.push(normalized.replace(/\s+/g, "."));
  }
  return formats;
}

function hangulPromptFormats(hangul) {
  if (!hangul) return [];
  return [hangul];
}

function kanaPromptFormats(text) {
  const normalized = text?.trim();
  if (!normalized) return [];
  const formats = [normalized];
  if (normalized.includes("・")) {
    formats.push(normalized.replace(/・/g, " "));
  }
  return formats;
}

function hanjaPromptFormats(text) {
  const normalized = text?.trim();
  if (!normalized) return [];
  return [normalized];
}

function buildTypewriterPromptSamples(generatedNames) {
  const poolsByType = {
    hangul: [],
    roman: [],
    kana: [],
    hanja: [],
  };
  const seen = new Set();
  const add = (type, text) => {
    const normalized = text?.trim();
    if (!normalized || seen.has(normalized)) return;
    if (poolsByType[type].length >= (TYPEWRITER_POOL_LIMITS[type] || 96)) return;
    if (!hasSearchableResultsForExample(normalized)) return;
    seen.add(normalized);
    poolsByType[type].push(normalized);
  };

  for (const item of shuffled(generatedNames || [])) {
    for (const format of hangulPromptFormats(item.hangul)) add("hangul", format);
    for (const format of romanPromptFormats(item.roman)) add("roman", format);
    for (const format of kanaPromptFormats(item.kana)) add("kana", format);
    for (const hanja of item.hanjaVariants?.length ? item.hanjaVariants : [item.hanja]) {
      for (const format of hanjaPromptFormats(hanja)) add("hanja", format);
    }
  }

  const picks = [];
  const used = new Set();
  const addPick = (text) => {
    if (!text || used.has(text) || picks.length >= TYPEWRITER_EXAMPLE_COUNT) return;
    used.add(text);
    picks.push(text);
  };

  for (const type of ["hangul", "roman", "kana", "hanja"]) {
    addPick(pickRandom(shuffled(poolsByType[type])));
  }

  const punctuatedPool = shuffled(
    [...poolsByType.roman, ...poolsByType.kana, ...poolsByType.hanja].filter((text) => /[.\-・\s]/.test(text)),
  );
  addPick(pickRandom(punctuatedPool));

  const shuffledPools = Object.fromEntries(
    Object.entries(poolsByType).map(([type, pool]) => [type, shuffled(pool)]),
  );
  const cursors = { hangul: 0, roman: 0, kana: 0, hanja: 0 };
  const typeOrder = shuffled(["hangul", "roman", "kana", "hanja"]);

  while (picks.length < TYPEWRITER_EXAMPLE_COUNT) {
    const before = picks.length;
    for (const type of typeOrder) {
      const pool = shuffledPools[type] || [];
      while (cursors[type] < pool.length && used.has(pool[cursors[type]])) {
        cursors[type] += 1;
      }
      addPick(pool[cursors[type]]);
      cursors[type] += 1;
      if (picks.length >= TYPEWRITER_EXAMPLE_COUNT) break;
    }
    if (picks.length === before) break;
  }

  return picks;
}

function setTypewriterText(text, searchValue = text) {
  if (!typewriterNameEl) return;
  typewriterNameEl.textContent = text;
  typewriterNameEl.dataset.searchValue = searchValue;
  updateTypewriterActionLabel();
}

function startTypewriterAnimation(samples) {
  if (!typewriterNameEl || !samples.length) return;
  if (typewriterTimerId) window.clearTimeout(typewriterTimerId);
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    setTypewriterText(samples[0], samples[0]);
    return;
  }

  let sampleIndex = 0;
  let charIndex = 0;
  let deleting = false;

  const tick = () => {
    const current = samples[sampleIndex] || "";
    const chars = Array.from(current);
    setTypewriterText(chars.slice(0, charIndex).join(""), current);

    if (!deleting && charIndex < chars.length) {
      charIndex += 1;
      typewriterTimerId = window.setTimeout(tick, TYPEWRITER_TYPE_DELAY_MS + Math.random() * 28);
      return;
    }

    if (!deleting) {
      deleting = true;
      typewriterTimerId = window.setTimeout(tick, TYPEWRITER_HOLD_DELAY_MS);
      return;
    }

    if (charIndex > 0) {
      charIndex -= 1;
      typewriterTimerId = window.setTimeout(tick, TYPEWRITER_DELETE_DELAY_MS);
      return;
    }

    deleting = false;
    sampleIndex = (sampleIndex + 1) % samples.length;
    typewriterTimerId = window.setTimeout(tick, TYPEWRITER_TYPE_DELAY_MS);
  };

  tick();
}

function hydrateTypewriterPrompt(generatedNames) {
  const samples = buildTypewriterPromptSamples(generatedNames);
  startTypewriterAnimation(samples.length ? samples : ["홍길동"]);
}

function hydrateRandomExamples(generatedNames = null) {
  if (!exampleChipEls.length) return;
  const sourceNames = generatedNames || shuffled(buildGeneratedExampleNames());
  const poolsByType = {
    hangul: shuffled(buildHangulExamplePool(sourceNames)),
    roman: shuffled(buildRomanExamplePool(sourceNames)),
    kana: shuffled(buildKanaExamplePool(sourceNames)),
  };
  const pool = shuffled([...poolsByType.hangul, ...poolsByType.roman, ...poolsByType.kana]);
  if (!pool.length) return;

  const picks = [];
  const used = new Set();

  for (const type of ["hangul", "roman", "kana"]) {
    const item = poolsByType[type].find((candidate) => !used.has(candidate.text));
    if (!item) continue;
    used.add(item.text);
    picks.push(item);
  }

  for (const item of shuffled(pool)) {
    if (picks.length >= exampleChipEls.length) break;
    if (used.has(item.text)) continue;
    used.add(item.text);
    picks.push(item);
  }

  const displayPicks = shuffled(picks);
  exampleChipEls.forEach((button, index) => {
    const item = displayPicks[index];
    if (!item) {
      button.hidden = true;
      return;
    }
    button.hidden = false;
    button.dataset.example = item.text;
    button.textContent = item.text;
  });
}

function readSearchHistory() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, SEARCH_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function writeSearchHistory(items) {
  try {
    window.localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(items.slice(0, SEARCH_HISTORY_LIMIT)));
  } catch {
    // Search still works when storage is unavailable.
  }
}

function updateHistoryCompactState(history = readSearchHistory()) {
  if (!historySectionEl) return;
  const hasVisibleResults = !!resultsSectionEl && !resultsSectionEl.classList.contains("is-hidden");
  historySectionEl.classList.toggle("is-results-visible", hasVisibleResults);
  historySectionEl.classList.toggle("has-overflow", hasVisibleResults && history.length > SEARCH_HISTORY_COMPACT_VISIBLE_COUNT);
}

function renderSearchHistory() {
  if (!historySectionEl || !historyListEl) return;
  const history = readSearchHistory();
  historySectionEl.hidden = history.length === 0;
  updateHistoryCompactState(history);
  historyListEl.innerHTML = "";
  for (const item of history) {
    const row = document.createElement("div");
    row.className = "history-item";
    const button = document.createElement("button");
    button.className = "history-query";
    button.type = "button";
    button.dataset.historyQuery = item;

    const icon = document.createElement("span");
    icon.className = "history-clock";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "◷";

    const text = document.createElement("span");
    text.className = "history-text";
    text.textContent = item;
    button.append(icon, text);

    const remove = document.createElement("button");
    remove.className = "history-remove";
    remove.type = "button";
    remove.dataset.historyRemove = item;
    remove.setAttribute("aria-label", t("removeHistoryItem", { name: item }));
    remove.textContent = "×";
    row.append(button, remove);
    historyListEl.appendChild(row);
  }
}

function addSearchHistoryItem(query) {
  const normalized = String(query || "").trim();
  if (!normalized) return;
  const history = readSearchHistory();
  const deduped = history.filter((item) => item !== normalized);
  writeSearchHistory([normalized, ...deduped]);
  renderSearchHistory();
}

function removeSearchHistoryItem(query) {
  const normalized = String(query || "").trim();
  if (!normalized) return;
  writeSearchHistory(readSearchHistory().filter((item) => item !== normalized));
  renderSearchHistory();
}

function clearSearchHistory() {
  writeSearchHistory([]);
  renderSearchHistory();
}

function submitSearch(query, options = {}) {
  const value = String(query || "").trim();
  search(value);
  if (value && options.recordHistory !== false) addSearchHistoryItem(value);
}

function hideResultsSection() {
  if (resultsRevealTimerId) {
    window.clearTimeout(resultsRevealTimerId);
    resultsRevealTimerId = null;
  }
  if (resultsSwapTimerId) {
    window.clearTimeout(resultsSwapTimerId);
    resultsSwapTimerId = null;
  }
  homePanelEl?.classList.remove("has-results");
  resultsSectionEl.classList.remove("is-entering", "is-exiting", "is-visible");
  resultsSectionEl.classList.add("is-hidden");
  resultsSectionEl.setAttribute("aria-hidden", "true");
  updateHistoryCompactState();
  if (interpretationEl) interpretationEl.textContent = "";
}

function showResultsSection(options = {}) {
  const { delay = true } = options;
  const alreadyVisible = resultsSectionEl.classList.contains("is-visible");
  homePanelEl?.classList.add("has-results");
  updateHistoryCompactState();
  if (resultsRevealTimerId) {
    window.clearTimeout(resultsRevealTimerId);
    resultsRevealTimerId = null;
  }
  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const reveal = () => {
    resultsRevealTimerId = null;
    resultsSectionEl.classList.add("is-resetting");
    resultsSectionEl.classList.remove("is-hidden", "is-exiting", "is-visible");
    resultsSectionEl.setAttribute("aria-hidden", "false");
    updateHistoryCompactState();
    resultsSectionEl.classList.add("is-entering");
    resultsSectionEl.getBoundingClientRect();
    window.setTimeout(() => {
      resultsSectionEl.classList.remove("is-resetting");
      resultsSectionEl.getBoundingClientRect();
      window.setTimeout(() => {
        resultsSectionEl.classList.remove("is-entering");
        resultsSectionEl.classList.add("is-visible");
      }, 20);
    }, 20);
  };

  if (alreadyVisible || reducedMotion || !delay) {
    reveal();
    return;
  }

  resultsSectionEl.setAttribute("aria-hidden", "true");
  resultsRevealTimerId = window.setTimeout(reveal, RESULTS_REVEAL_DELAY_MS);
}

function collectCandidatesForQuery(query) {
  state.queryMeta = analyzeQueryMeta(query);
  const candidateMap = new Map();
  if (hasUnsupportedRomanPunctuation(query)) return candidateMap;
  addExactNameCandidates(query, candidateMap);
  searchStandaloneHangul(query, candidateMap);
  searchStandaloneLatin(query, candidateMap);
  searchStandaloneKana(query, candidateMap);
  searchStandaloneHanja(query, candidateMap);
  searchHangul(query, candidateMap);
  searchLatin(query, candidateMap);
  searchKana(query, candidateMap);
  searchHanja(query, candidateMap);
  searchMixedGroups(query, candidateMap);
  return collapseDuplicateStandaloneRoles(pruneImplausibleCandidates(candidateMap));
}

function hasSearchableResultsForExample(text) {
  if (!text?.trim()) return false;
  const previousQueryMeta = state.queryMeta;
  const prunedCandidateMap = collectCandidatesForQuery(text);
  state.queryMeta = previousQueryMeta;
  return prunedCandidateMap.size > 0;
}

function clearInputGuidance() {
  if (!inputGuidanceEl) return;
  inputGuidanceEl.replaceChildren();
  inputGuidanceEl.classList.remove("is-warning", "is-visible");
}

function appendInputGuidanceClose(query) {
  const close = document.createElement("button");
  close.type = "button";
  close.className = "input-guidance-close";
  close.setAttribute("aria-label", t("dismissInputGuidance"));
  close.title = t("dismissInputGuidance");
  close.textContent = "×";
  close.addEventListener("click", () => {
    state.dismissedInputGuidanceQuery = String(query || "").trim();
    clearInputGuidance();
  });
  return close;
}

function buildQueryRomanSuggestionIndex(candidateMap) {
  const entries = [];
  const candidates = [...candidateMap.values()]
    .sort((first, second) => candidateRankingScore(second) - candidateRankingScore(first))
    .slice(0, 12);
  for (const candidate of candidates) {
    const candidateWeight = Math.max(1, candidateRankingScore(candidate));
    const exactRows = gatherExactRowsForHangul(candidate.hangul, candidate);
    const outputs = generateOutputsForCandidate(candidate, exactRows);
    for (const item of outputs.romanOutputs || []) {
      entries.push({ text: item.text, weight: candidateWeight + Number(item.score || 0) });
    }
    if (candidate.kind !== "full") continue;
    const { surname, given } = splitNameUnits(candidate.hangul, state.runtime?.compoundSurnames);
    for (const surnameOutput of generateSurnameRomanOutputs(surname).slice(0, 3)) {
      entries.push({
        text: surnameOutput.text,
        weight: candidateWeight + Number(surnameOutput.score || 0) + 1,
      });
      for (const givenOutput of generateGivenRomanOutputs(given).slice(0, 8)) {
        const joinedGiven = normalizeLatin(givenOutput.text);
        if (!joinedGiven) continue;
        entries.push({
          text: givenOutput.text,
          weight: candidateWeight + Number(givenOutput.score || 0),
        });
        entries.push({
          text: `${surnameOutput.text} ${joinedGiven}`,
          weight: candidateWeight + Number(surnameOutput.score || 0) + Number(givenOutput.score || 0) + 1,
        });
      }
    }
  }
  return entries.length ? createKoreanRomanSuggestionIndex(entries) : null;
}

function hasDirectRomanNameResolution(query, candidateMap) {
  const normalizedQuery = normalizeLatin(query);
  if (!normalizedQuery) return false;
  return [...candidateMap.values()].some((candidate) => {
    if (candidate.kind !== "full") return false;
    const evidence = candidate.evidence ? [...candidate.evidence] : [];
    if (evidence.some((item) => /Supplemental attested Roman query match|Exact Romanized name match/.test(item))) {
      return true;
    }
    const exactRows = gatherExactRowsForHangul(candidate.hangul, candidate);
    return generateOutputsForCandidate(candidate, exactRows).romanOutputs.some(
      (item) => normalizeLatin(item.text) === normalizedQuery,
    );
  });
}

function hasInputAlignedRomanFullNameResolution(query, candidateMap) {
  const groups = splitRomanGroups(query);
  if (groups.length < 2 || groups[0].length !== 1) return false;

  const surnameToken = normalizeLatin(groups[0][0]);
  const givenToken = normalizeLatin(groups.slice(1).flat().join(""));
  if (!surnameToken || !givenToken) return false;

  const surnameMatches = new Set(
    (state.data?.surnameLatinIndex?.[surnameToken] || []).map((item) => item.hangul),
  );
  if (!surnameMatches.size) return false;

  const indexedGivens = state.runtime?.givenRomanIndex?.get(givenToken);
  return [...candidateMap.values()].some((candidate) => {
    if (candidate.kind !== "full") return false;
    const { surname, given } = splitNameUnits(candidate.hangul, state.runtime?.compoundSurnames);
    if (!surnameMatches.has(surname) || !given) return false;
    if (indexedGivens?.has(given)) return true;
    return generateGivenRomanOutputs(given).some((item) => normalizeLatin(item.text) === givenToken);
  });
}

function suggestSurnameFirstOrderCorrection(query, candidateMap) {
  const tokens = String(query || "").trim().split(/[^A-Za-z]+/).filter(Boolean);
  if (tokens.length !== 2) return null;
  const firstToken = normalizeLatin(tokens[0]);
  const secondToken = normalizeLatin(tokens[1]);
  const exactFirstSurnames = state.data?.surnameLatinIndex?.[firstToken] || [];
  if (!exactFirstSurnames.length) return null;

  for (const candidate of candidateMap.values()) {
    if (candidate.kind !== "full") continue;
    const { surname, given } = splitNameUnits(candidate.hangul, state.runtime?.compoundSurnames);
    if (Array.from(surname).length !== 1 || Array.from(given).length !== 1) continue;
    if (!exactFirstSurnames.some((item) => item.hangul === given)) continue;
    const parsedSurnameForms = generateSurnameRomanOutputs(surname);
    if (parsedSurnameForms.some((item) => normalizeLatin(item.text) === secondToken)) continue;

    const surnameForm = generateSurnameRomanOutputs(given).find((item) => normalizeLatin(item.text) === firstToken);
    const givenForm = [...generateGivenRomanOutputs(surname)]
      .sort((first, second) => keyboardWeightedDistance(secondToken, first.text) - keyboardWeightedDistance(secondToken, second.text) || Number(second.score || 0) - Number(first.score || 0))[0];
    if (surnameForm && givenForm) {
      const formattedGiven = `${givenForm.text.charAt(0).toUpperCase()}${givenForm.text.slice(1)}`;
      return { text: `${surnameForm.text} ${formattedGiven}` };
    }
  }
  return null;
}

function suggestRomanTokenCorrection(query, index) {
  if (!index || String(query || "").trim().split(/[^A-Za-z]+/).filter(Boolean).length < 2) return null;
  let changed = false;
  const text = String(query || "").replace(/[A-Za-z]+/g, (token) => {
    const suggestion = analyzeLatinNameInput(token, index).suggestion;
    if (!suggestion) return token;
    changed = true;
    return suggestion.text;
  });
  return changed ? { text } : null;
}

function renderInputGuidance(query, candidateMap) {
  if (!inputGuidanceEl) return;
  clearInputGuidance();
  if (hasUnsupportedRomanPunctuation(query)) return;
  const normalizedQuery = String(query || "").trim();
  if (state.dismissedInputGuidanceQuery === normalizedQuery) return;
  const hasDirectResolution =
    hasDirectRomanNameResolution(query, candidateMap) ||
    hasInputAlignedRomanFullNameResolution(query, candidateMap);
  if (hasDirectResolution) return;
  const querySuggestionIndex = buildQueryRomanSuggestionIndex(candidateMap);
  const runtimeSuggestionIndex = state.runtime?.romanSuggestionIndex;
  const useRuntimeShorthandIndex = isKoreanRomanShorthand(normalizedQuery);
  const primarySuggestionIndex = useRuntimeShorthandIndex
    ? runtimeSuggestionIndex || querySuggestionIndex
    : querySuggestionIndex || runtimeSuggestionIndex;
  let guidance = analyzeLatinNameInput(query, primarySuggestionIndex);
  if (!guidance.possibleChinese && !guidance.suggestion && useRuntimeShorthandIndex && querySuggestionIndex) {
    guidance = analyzeLatinNameInput(query, querySuggestionIndex);
  }
  if (!guidance.possibleChinese && !guidance.suggestion && querySuggestionIndex && runtimeSuggestionIndex) {
    guidance = analyzeLatinNameInput(query, runtimeSuggestionIndex);
  }
  if (!guidance.possibleChinese && !guidance.suggestion) {
    const orderSuggestion = suggestSurnameFirstOrderCorrection(query, candidateMap);
    if (orderSuggestion) {
      guidance = { possibleChinese: null, suggestion: orderSuggestion };
    } else {
      let tokenSuggestion = suggestRomanTokenCorrection(query, querySuggestionIndex);
      if (!tokenSuggestion && runtimeSuggestionIndex && runtimeSuggestionIndex !== querySuggestionIndex) {
        tokenSuggestion = suggestRomanTokenCorrection(query, runtimeSuggestionIndex);
      }
      if (tokenSuggestion) guidance = { possibleChinese: null, suggestion: tokenSuggestion };
    }
  }
  if (!guidance.possibleChinese && guidance.suggestion && !hasSearchableResultsForExample(guidance.suggestion.text)) {
    guidance = { possibleChinese: null, suggestion: null };
  }
  const card = document.createElement("div");
  card.className = "input-guidance-card";
  const icon = document.createElement("span");
  icon.className = "input-guidance-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "i";
  const content = document.createElement("div");
  content.className = "input-guidance-content";
  if (guidance.possibleChinese) {
    inputGuidanceEl.classList.add("is-warning");
    icon.classList.add("is-warning-icon");
    const warningIcon = document.createElement("img");
    warningIcon.src = "./assets/icons/lds_exclamation-triangle_extrabold.svg";
    warningIcon.alt = "";
    icon.replaceChildren(warningIcon);
    content.textContent = t("possibleChineseRomanization");
    card.append(icon, content, appendInputGuidanceClose(normalizedQuery));
    inputGuidanceEl.append(card);
    inputGuidanceEl.classList.add("is-visible");
    return;
  }
  if (!guidance.suggestion) return;

  const prefix = document.createTextNode(`${t("inputSuggestionPrefix")} `);
  const suggestion = document.createElement("button");
  suggestion.type = "button";
  suggestion.className = "input-guidance-suggestion";
  suggestion.textContent = guidance.suggestion.text;
  suggestion.addEventListener("click", () => {
    queryEl.value = guidance.suggestion.text;
    submitSearch(queryEl.value);
    queryEl.focus();
  });
  content.append(prefix, suggestion, document.createTextNode(t("inputSuggestionSuffix")));
  card.append(icon, content, appendInputGuidanceClose(normalizedQuery));
  inputGuidanceEl.append(card);
  inputGuidanceEl.classList.add("is-visible");
}

function search(query) {
  if (!query.trim()) {
    resultsEl.innerHTML = "";
    state.queryMeta = null;
    state.hangnyeolQueryHanja = "";
    clearInputGuidance();
    hideResultsSection();
    return;
  }

  state.hangnyeolQueryHanja = extractHanja(query);
  const prunedCandidateMap = collectCandidatesForQuery(query);
  renderInputGuidance(query, prunedCandidateMap);
  if (interpretationEl) {
    interpretationEl.textContent = deriveInterpretationText(query, prunedCandidateMap);
  }
  buildResultCards(prunedCandidateMap);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

async function init() {
  const [response, hanjaReadingData, hanjaNameCharData, hanjaUsageRankData, bonGwanData, hangnyeolData] = await Promise.all([
    fetch(dataUrl),
    fetchOptionalJson(hanjaReadingUrl),
    fetchOptionalJson(hanjaNameCharUrl),
    fetchOptionalJson(hanjaUsageRankUrl),
    fetchOptionalJson(bonGwanDataUrl),
    fetchOptionalJson(hangnyeolDataUrl),
  ]);
  state.data = await response.json();
  state.bonGwanData = bonGwanData;
  state.hangnyeolData = hangnyeolData;
  attachHanjaReadingData(state.data, hanjaReadingData);
  attachHanjaNameCharData(state.data, hanjaNameCharData);
  attachHanjaUsageRankData(state.data, hanjaUsageRankData);
  attachBonGwanSurnameHanjaData(state.data, state.bonGwanData);
  attachInitialSoundLawSurnameHanjaAliases(state.data, state.bonGwanData);
  sanitizeModernKoreanRomanData(state.data);
  rebuildSurnameHanjaIndex(state.data);
  state.runtime = buildRuntime(state.data);
  state.runtime.romanSuggestionIndex = buildRomanSuggestionIndex(state.data);
  const generatedNames = shuffled(buildGeneratedExampleNames());
  hydrateRandomExamples(generatedNames);
  hydrateTypewriterPrompt(generatedNames);
  renderSearchHistory();
  resultsEl.innerHTML = "";
  hideResultsSection();
}

formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  submitSearch(queryEl.value);
});

queryEl?.addEventListener("input", () => {
  state.dismissedInputGuidanceQuery = null;
  clearInputGuidance();
});

typewriterNameEl?.addEventListener("click", () => {
  const name = typewriterNameEl.dataset.searchValue?.trim() || typewriterNameEl.textContent?.trim();
  if (!name) return;
  queryEl.value = name;
  if (typeof formEl.requestSubmit === "function") formEl.requestSubmit();
  else submitSearch(name);
  window.requestAnimationFrame(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    resultsSectionEl?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  });
});

exampleChipEls.forEach((button) => {
  button.addEventListener("click", () => {
    queryEl.value = button.dataset.example || "";
    submitSearch(queryEl.value);
  });
});

historyListEl?.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const removeButton = target?.closest("[data-history-remove]");
  if (removeButton) {
    removeSearchHistoryItem(removeButton.dataset.historyRemove);
    return;
  }
  const queryButton = target?.closest("[data-history-query]");
  if (!queryButton) return;
  const value = queryButton.dataset.historyQuery || "";
  queryEl.value = value;
  submitSearch(value);
});

clearHistoryEl?.addEventListener("click", () => {
  clearSearchHistory();
});

siteTabEls.forEach((tab) => {
  tab.addEventListener("click", () => setActiveSiteTab(tab.dataset.tab));
  tab.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      moveSiteTabFocus(tab, event.key === "ArrowRight" ? 1 : -1);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const target = event.key === "Home" ? siteTabEls[0] : siteTabEls[siteTabEls.length - 1];
      setActiveSiteTab(target?.dataset.tab, { focus: true });
    }
  });
});

aboutExampleEls.forEach((button) => {
  button.addEventListener("click", () => {
    const example = button.dataset.aboutExample?.trim();
    if (!example) return;
    setActiveSiteTab("home");
    queryEl.value = example;
    if (typeof formEl.requestSubmit === "function") formEl.requestSubmit();
    else submitSearch(example);
    window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      resultsSectionEl?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
  });
});

languageTriggerEl?.addEventListener("click", () => {
  setLanguageMenuOpen(languageMenuEl?.hidden ?? true);
});

languageTriggerEl?.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && languageTriggerEl.getAttribute("aria-expanded") === "true") {
    event.preventDefault();
    setLanguageMenuOpen(false);
    return;
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    setLanguageMenuOpen(true, true);
  }
});

languageOptionEls.forEach((option) => {
  option.addEventListener("click", () => {
    setLanguage(option.dataset.language);
    languageTriggerEl?.focus();
  });
});

languageMenuEl?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    setLanguageMenuOpen(false);
    languageTriggerEl?.focus();
    return;
  }
  if (event.key === "Tab") {
    setLanguageMenuOpen(false);
    return;
  }
  if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    const option = event.key === "Home" ? languageOptionEls[0] : languageOptionEls[languageOptionEls.length - 1];
    option?.focus();
    return;
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    moveLanguageMenuFocus(event.key === "ArrowDown" ? 1 : -1);
  }
});

document.addEventListener("click", (event) => {
  if (!languageMenuEl || languageMenuEl.hidden || languageSelectorEl?.contains(event.target)) return;
  setLanguageMenuOpen(false);
});

setLanguage(state.language, { persist: false, rerender: false });
setActiveSiteTab("home");

init().catch((error) => {
  console.error(error);
  resultsEl.innerHTML = `<div class="empty-state" role="status">${t("loadFailed")}</div>`;
  showResultsSection();
});
