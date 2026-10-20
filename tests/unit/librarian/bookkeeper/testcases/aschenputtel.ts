/**
 * Input text for paragraph preservation test (first two paragraphs).
 */
export const ASCHENPUTTEL_FIRST_TWO_PARAGRAPHS = `Einem reichen Manne, dem wurde seine Frau krank, und als sie fühlte, daß ihr Ende herankam, rief sie ihr einziges Töchterlein zu sich ans Bett und sprach:

"Liebes Kind, bleibe fromm und gut, so wird dir der liebe Gott immer beistehen, und ich will vom Himmel auf dich herabblicken, und will um dich sein." Darauf tat sie die Augen zu und verschied. Das Mädchen ging jeden Tag hinaus zu dem Grabe der Mutter und weinte, und blieb fromm und gut. Als der Winter kam, deckte der Schnee ein weißes Tüchlein auf das Grab, und als die Sonne im Frühjahr es wieder herabgezogen hatte, nahm sich der Mann eine andere Frau.

Die Frau hatte zwei Töchter mit ins Haus gebracht, die schön und weiß von Angesicht waren, aber garstig und schwarz von Herzen. Da ging eine schlimme Zeit für das arme Stiefkind an. "Soll die dumme Gans bei uns in der Stube sitzen!" sprachen sie, "wer Brot essen will, muß verdienen: hinaus mit der Küchenmagd!" Sie nahmen ihm seine schönen Kleider weg, zogen ihm einen grauen, alten Kittel an und gaben ihm hölzerne Schuhe. "Seht einmal die stolze Prinzessin, wie sie geputzt ist!" riefen sie, lachten und führten es in die Küche. Da mußte es von Morgen bis Abend schwere Arbeit tun, früh vor Tag aufstehen, Wasser tragen, Feuer anmachen, kochen und waschen. Obendrein taten ihm die Schwestern alles ersinnliche Herzeleid an, verspotteten es und schütteten ihm die Erbsen und Linsen in die Asche, so daß es sitzen und sie wieder auslesen mußte. Abends, wenn es sich müde gearbeitet hatte, kam es in kein Bett, sondern mußte sich neben den Herd in die Asche legen. Und weil es darum immer staubig und schmutzig aussah, nannten sie es Aschenputtel.`;

/**
 * Expected output for paragraph preservation test.
 * Note: paragraph breaks in the source are preserved with 3 blank lines (4 newlines).
 * The input has 2 paragraph breaks:
 * 1. After "sprach:" before the quoted speech
 * 2. After "andere Frau." before the new paragraph
 */
export const EXPECTED_BLOCK_OUTPUT_WITH_PARAGRAPHS = `Einem reichen Manne, dem wurde seine Frau krank, und als sie fühlte, daß ihr Ende herankam, rief sie ihr einziges Töchterlein zu sich ans Bett und sprach: ^0



"Liebes Kind, bleibe fromm und gut, so wird dir der liebe Gott immer beistehen, und ich will vom Himmel auf dich herabblicken, und will um dich sein." ^1

Darauf tat sie die Augen zu und verschied. ^2

Das Mädchen ging jeden Tag hinaus zu dem Grabe der Mutter und weinte, und blieb fromm und gut. ^3

Als der Winter kam, deckte der Schnee ein weißes Tüchlein auf das Grab, und als die Sonne im Frühjahr es wieder herabgezogen hatte, nahm sich der Mann eine andere Frau. ^4



Die Frau hatte zwei Töchter mit ins Haus gebracht, die schön und weiß von Angesicht waren, aber garstig und schwarz von Herzen. ^5

Da ging eine schlimme Zeit für das arme Stiefkind an. ^6

"Soll die dumme Gans bei uns in der Stube sitzen!" sprachen sie, "wer Brot essen will, muß verdienen: hinaus mit der Küchenmagd!" ^7

Sie nahmen ihm seine schönen Kleider weg, zogen ihm einen grauen, alten Kittel an und gaben ihm hölzerne Schuhe. ^8

"Seht einmal die stolze Prinzessin, wie sie geputzt ist!" riefen sie, lachten und führten es in die Küche. ^9

Da mußte es von Morgen bis Abend schwere Arbeit tun, früh vor Tag aufstehen, Wasser tragen, Feuer anmachen, kochen und waschen. ^10

Obendrein taten ihm die Schwestern alles ersinnliche Herzeleid an, verspotteten es und schütteten ihm die Erbsen und Linsen in die Asche, so daß es sitzen und sie wieder auslesen mußte. ^11

Abends, wenn es sich müde gearbeitet hatte, kam es in kein Bett, sondern mußte sich neben den Herd in die Asche legen. ^12

Und weil es darum immer staubig und schmutzig aussah, nannten sie es Aschenputtel. ^13`;