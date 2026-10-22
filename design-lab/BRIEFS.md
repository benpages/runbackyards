# Six directions for the race page

All six use the same page: Sydney's Backyard Ultra, September 2026, with its real data and copy.
Open `direction-N/index.html` in a browser. Screenshots are in `screens/`.
Rebuild after edits: `node design-lab/build.mjs` (or `node design-lab/build.mjs 4` for one).

Photos are stand-ins from the repo, none from Sydney. They are labeled on the page.

## 1. Matchday program (seeded)
- **Feeling:** the printed program at a running club's big day. Proud and warm; the club looks after its own.
- **Type:** Archivo, stretched wide for headlines and names, normal width for reading.
- **Palette:** bottle green, cream, one gold for the winner and the biggest number on the page.
- **Charts and tables:** the written takeaway is the biggest type in each section, and the chart sits under it as evidence. The dropouts section flips to green, and the 98 bar turns gold. The lap table is a green heat grid: darker means faster.
- **Homepage:** latest race as a green program cover (photo left, winner right); the other races listed below like fixtures.

## 2. The sports section (seeded)
- **Feeling:** Monday's paper, the results page you read over coffee. Serious, dense, and trustworthy.
- **Type:** Newsreader (serif) for headlines and reading; IBM Plex Sans Condensed for tables, labels and charts.
- **Palette:** newsprint, black ink, process magenta (women, the peak), cyan (second line), yellow highlighter on the winner's row.
- **Charts and tables:** charts sit in newspaper columns next to the text they support, with fine rules between. The results sit beside the photo like a results box. Lap times are plain figures: bold when fast, magenta when slow.
- **Homepage:** a front page. One lead race with a big headline and photo, then briefs, and articles as columns.

## 3. Hi-vis grid (seeded)
- **Feeling:** a technical running brand's lookbook: precise, cool, athletic. One hi-vis orange, like a bib or a safety vest.
- **Type:** Instrument Sans, condensed for headlines, regular for everything else. Size carries the hierarchy, not weight.
- **Palette:** off-white, black, one hi-vis orange.
- **Charts and tables:** every runner who stopped is one dot, so the dropout chart shows 630 people, not bars. On phones it turns sideways, one row per loop. The hero shows the winner's 66 loops as rings, with night loops filled. In the lap table, each runner's fastest loop is orange and their slowest is boxed.
- **Homepage:** a strict 5 and 7 column grid. Each race is a ring pattern (one ring per loop) next to a photo.

## 4. Timing tent, 3am (theme)
- **Feeling:** under the tent at 3am: dark, quiet, lit only where it matters. The race clock is always on screen.
- **Type:** Chivo for words, Chivo Mono for every number and label.
- **Palette:** near-black, headlamp white, sodium amber for the clock and anything important. Night is the default.
- **Charts and tables:** the dropout chart becomes a loop board. Each column is a race day and each row an hour from the 8am start, so night hours line up across all three days. Each cell glows brighter the more runners stopped there. On desktop it turns sideways into three long rows. The race clock stays pinned at the top. In the lap table, fast loops are amber and slow loops fade.
- **Homepage:** a wall of live boards, one per race: loops, clock, winner. Reads like the timing screens at the start line.

## 5. The crew's log (theme)
- **Feeling:** the sheet a crew fills in through the night. Working, honest, human. A red pen marks only what a crew would mark.
- **Type:** Libre Franklin for the printed sheet, IBM Plex Mono for the numbers, Nanum Pen Script for a few handwritten notes. Each note quotes a sentence already on the page.
- **Palette:** off-white sheet, graphite, pale blue rules, red pen.
- **Charts and tables:** the race ending is a log of the last ten loops side by side. Loop 63 is circled, and Warren's loop 66 reads "Did not finish" in pen. In the dropout chart, the four distance milestones are outlined and labeled in pen. In the lap table, each runner's fastest loop is circled.
- **Homepage:** a stack of race sheets, each with its header filled in and its winner circled.

## 6. The race poster (theme)
- **Feeling:** a gig poster for the race. Loud and proud, printed in two inks.
- **Type:** Big Shoulders Display (condensed, heavy, never tracked tighter) for display, Public Sans for reading.
- **Palette:** warm paper, navy ink, fluorescent red printed over the photo.
- **Charts and tables:** the winner's loop count is the hero at poster size. The top 10 are billed like a festival lineup, with each name in smaller type than the one above. Each section opens with its key number from the takeaway, set huge. The dropouts section is printed in reverse on navy.
- **Homepage:** one poster per race, laid out as a wall. The newest race is the biggest.
