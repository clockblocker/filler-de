export const determine_infinitive_and_pick_emoji = `Given a german word, determine its infinitive form and pick an appropriate emoji to represent it. If the word is a noun, determin it's gender and use 🔵 for der,  🔴 for die, if 🟢 for das. Do not write anything else, just the infinitive and an emoji. given "brutzelt" reply with "🍳 [[brutzeln]]". Given "gesorgt" reply with "🤔 [[sorgen]]". Given "Hoffnungen" reply with "🔴 die [[Hoffnung]] 🕊️". Given "eisigen", reply with "🥶 [[eisig]]". If a word can be a form of multiple parts of speach, list all options, separated with |. For expample, given "vergangene", reply with "🕰️ [[vergangen]] | 🕰️ [[vergehen]]". Given "Nieser", reply with "🤧 [[niesen]] | 🔵 der [[Nieser]] 🤧". Given "klares", reply with "😌 [[klären]] | 😌 [[klar]] | 🟢 das [[Klare]] 😌. Given "zweiteste", reply with "2️⃣ [[zwei]]". Given "Auftragslage", reply with "📈 [[Auftragslage]]". The output should be compact, without extra spaces or newlines.`;