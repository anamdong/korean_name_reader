# GitHub Pages Upload

Upload the contents of this folder to a GitHub repository and enable GitHub Pages for that repository.

Included files:

- `index.html`
- `app.js`
- `styles.css`
- `data/name_index.json`
- `data/hanja_readings.json`
- `data/hanja_name_chars.json`
- `data/hanja_usage_rank.json`
- `data/bon_gwan_by_surname.json`
- `.nojekyll`

`data/hanja_readings.json` is a compact extract of Unicode Unihan `kHangul` readings from `Unihan_Readings.txt`, used as a fallback for Hanja full-name input.

`data/bon_gwan_by_surname.json` is derived from KOSIS table `DT_1IN15SB`, the 2015 Population and Housing Census table for population by surname and bon-gwan. Each record uses an exact Hangul-Hanja surname key, so surnames such as `유(柳)` and `유(劉)` have independent totals. The KOSIS source combines bon-gwan with fewer than 1,000 people as `기타`.

KOSIS supplies its bon-gwan labels in Hangul. The checked-in JSON also carries a surname-specific `hanja` label for every named bon-gwan. These labels are resolved against a Korean clan index and checked against a historical-place index; exact surname-Hanja pairs and census counts disambiguate homographs such as `순천(順天)` and `순천(順川)`. Japanese and Traditional Chinese interfaces display this Hanja label, while English keeps the Hangul label.

Rebuild the bon-gwan data from the CP949 KOSIS mass-download CSV, then enrich its place labels from a saved clan index:

```sh
python3 scripts/build_bon_gwan_data.py 101_DT_1IN15SB_F_2015.csv /tmp/bon_gwan_kosis.json
curl -L https://ph3588.tistory.com/4 -o /tmp/bon_gwan_ranked.html
python3 scripts/enrich_bon_gwan_hanja.py /tmp/bon_gwan_kosis.json /tmp/bon_gwan_ranked.html data/bon_gwan_by_surname.json
```

The build fails if a surname's bon-gwan rows do not add up to its exact census total. The enrichment fails if any named bon-gwan lacks a reviewed Hanja label. The place-name cross-reference is documented at `https://www.surname.info/local.html`; spot checks use the Academy of Korean Studies' Encyclopedia of Korean Culture.

Recommended deployment:

1. Create a new GitHub repository.
2. Upload all files from this folder to the repository root.
3. In GitHub, open `Settings -> Pages`.
4. Set the source to `Deploy from a branch`.
5. Select the `main` branch and the `/ (root)` folder.

The app uses relative paths, so it works both on a custom domain and on a project Pages URL.
