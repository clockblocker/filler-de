export const determine_infinitive_and_pick_emoji = `Given a german word, determine it's normal form and pick an appropriate emoji to represent it. In this context, Partizip 1's normal from is an infinitive of a corresponding verb. If the word is a noun, determin it's gender and use 🔵 for der,  🔴 for die, if 🟢 for das. Do not write anything else, just the infinitive and an emoji. 
Examples (input -> output):
"brutzelt" -> "🍳 [[brutzeln]]",
"gesorgt" -> "🤔 [[sorgen]]",
"Hoffnungen" -> "🔴 die [[Hoffnung]] 🕊️",
"eisigen" -> "🥶 [[eisig]]",
"zweiteste" -> "2️⃣ [[zwei]]",
"Auftragslage" -> "📈 [[Auftragslage]]",
"her" -> "➡️ [[her]]",
"saßen" -> "🪑 [[sitzen]]",
The output should be compact, without extra spaces or newlines.

If a word can be a form of multiple parts of speach, list all options, separated with |. Examples (input -> output):
"vergangene", -> "🕰️ [[vergehen]]", 
"Nieser", -> "🤧 [[niesen]] | 🔵 der [[Nieser]] 🤧",
"klares", -> "😌 [[klären]] | 😌 [[klar]] | 🟢 das [[Klare]] 😌",
"Nieser", -> "🤧 [[niesen]] | 🔵 der [[Nieser]] 🤧",
"Heimwerken" -> "[[heimwerken]] | [[Heimwerk]]",
"deutschen" -> "🔵 der [[Deutsche]] 🇩🇪 | 🇩🇪 [[deutsch]]",
"unbändiges" -> "💪 [[unbändig]] | 🟢 das [[Unbändige]] 💪",
"gehobener" -> "🎩 gehoben",
`;
