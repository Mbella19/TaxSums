Newsreader, by Production Type — https://github.com/productiontype/Newsreader
Licensed under the SIL Open Font License 1.1. Full text in OFL.txt.

These are not the upstream files. They were derived from the Google Fonts
Latin subset as follows, which is permitted under the OFL:

  1. Subset to the characters this site emits (Latin basic, Latin-1
     punctuation, sterling, curly quotes, dashes, arrows, minus).
  2. Roman: optical-size axis pinned at 30; weight axis kept (200-800).
     Italic: both axes pinned, so it is a single static cut.

Result: 196 KB -> 50 KB across the two files.

To rebuild after a font update:

  pip install fonttools brotli
  pyftsubset newsreader-roman.woff2 --unicodes="U+0020-007E,U+00A0,U+00A3,\
    U+00A9,U+00AB,U+00BB,U+00D7,U+00F7,U+2010-2015,U+2018-201A,U+201C-201E,\
    U+2020-2022,U+2026,U+2030,U+2032-2033,U+2039-203A,U+2044,U+20AC,U+2122,\
    U+2190-2193,U+2212,U+25CF" \
    --layout-features='kern,liga,calt,tnum,onum,frac' --flavor=woff2 \
    --no-hinting --desubroutinize --output-file=out.woff2
  fonttools varLib.instancer out.woff2 opsz=30 --output=out.ttf
