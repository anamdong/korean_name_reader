# Bon-gwan Map Explorer Data

## Geometry

The local peninsula map uses province/equivalent (`ADM1`) geometry from
[geoBoundaries](https://www.geoboundaries.org/). The South Korean layer is
derived from Natural Earth and is public domain. The North Korean layer is
derived from World Food Programme/OCHA ROAP data and is licensed
[CC BY 3.0 IGO](https://creativecommons.org/licenses/by/3.0/igo/).

The checked-in GeoJSON is intentionally used locally. The map has no runtime
map API, API key, or network dependency. Its resolution is provincial: it is a
thematic origin map, not a historical-boundary reconstruction.

## Bon-gwan Locations

`bongwan_geography.json` maps exact historical Bon-gwan Hangul/Hanja labels to
a present-day province/equivalent only where the association is reasonably
clear. The original Bon-gwan label is never replaced. The mapping is a
conservative place-to-region association, not a claim that a historical clan
seat fills a modern administrative area.

Names whose location cannot be represented responsibly at this resolution stay
searchable and appear under **Location uncertain**. Documented overseas origins
appear in **Origins outside the Korean Peninsula** and are never plotted on the
peninsula.

## Population And Reports

Population counts remain the checked-in 2015 KOSIS `DT_1IN15SB` figures. The
explorer joins them to locations by the existing canonical clan ID:
`surnameHangul|surnameHanja|bonGwanHangul|bonGwanHanja`. Its report reuses
verified/corroborated rows in `hangnyeol_by_clan.json`; branch-scoped rows keep
their branch scope.

## Search And Heatmap

Search indexes Hangul, Hanja, normalized Roman letters, spaces, punctuation,
and the supported Roman surname aliases. Textual relevance ranks ahead of
population. Region shading sums each matched canonical clan once and applies a
square-root scale, so very large clans do not flatten all smaller regions.

To add or correct a location, add the exact `place|Hanja` key to the relevant
mapping in `bongwan_geography.json`, set a realistic confidence value, and keep
an uncertain entry when the modern regional association is not defensible.

## Historical Place Validation

The mapping review also uses the [Encyclopedia of Korean Culture](https://encykorea.aks.ac.kr/)
for historical place identity and modern administrative continuity. For example,
its [E0036172 entry for Eonyang](https://encykorea.aks.ac.kr/Article/E0036172)
identifies `언양(彦陽)` with present-day Eonyang-eup, Ulju-gun, Ulsan. The 2026-08-21
review added only similarly specific place/Hanja pairs, including `광주(廣州)`,
`이천(利川)`, `전의(全義)`, `성산(星山)`, `벽진(碧珍)`, and `동복(同福)`.
Ambiguous labels remain in **Location uncertain** rather than being inferred
from their Hangul spelling alone.

## One-Pass Exact Index Review

On 2026-08-21, a completed one-pass review matched unresolved labels against
the [Surname.info historical-place index](https://www.surname.info/local.html).
It initially added 54 peninsula mappings and one documented Chinese origin from
exact Hangul/Hanja pairs. Follow-up reviews resolved 32 more historical spellings,
compatibility-Hanja forms, and documented aliases. Where the index names a
specific linked locality, it takes precedence over an obsolete broad-province
label: for example, `하빈(河濱)` maps through 달성 to Daegu. `영성(靈城)` is
recorded as the historical name of 영광 정씨 and maps to South Jeolla.

The full place set was also checked against direct clan-form articles in Korean
Wikipedia when the index did not resolve an alias. This added, for example,
`낭주/랑주(朗州)` through 영암, `면성(綿城)` through 무안,
`설성(雪城)` through 개성, `팔계(八溪)` through 초계, and
`효령(孝令)` through 군위. Matching Hanja alone is not treated as evidence:
existing current-region mappings are retained when a source result refers to a
different place sharing the same characters.

The targeted review also resolved `부림(缶林)` through 군위 부계,
`상산(常山)` through 진천, `여강(驪江)` through 여주, and
`의춘(宜春)` through 의령. Similar-looking `선선(旋善)`, `태안(太安)`,
`화산(華山)`, and `조천(鳥川)` did not receive mappings because their sources
did not establish the required location identity.

Labels without a defensible present-day regional association remain uncertain;
`장천(長川)` is one such case. This is a completed batch review, not a
recurring location-validation process.
