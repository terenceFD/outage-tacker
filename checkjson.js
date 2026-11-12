 const fs = require("fs");
for (const f of ["messages/en.json", "messages/fr.json"]) {
  try {
    JSON.parse(fs.readFileSync(f, "utf8"));
    console.log(f, "OK");
  } catch (e) {
    console.log(f, "FAIL:", e.message);
    const s = fs.readFileSync(f, "utf8");
    const pos = Number(/position (\d+)/.exec(e.message)?.[1] ?? 0);
    console.log(JSON.stringify(s.substring(Math.max(0, pos - 120), pos + 40)));
  }
}
