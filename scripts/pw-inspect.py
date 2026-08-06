import sys, asyncio, json
from playwright.async_api import async_playwright

USAGE = """usage:
  shot <url> <out.png> <w> <h> [actions]      — screenshot; actions: "hover:SEL:MS;click:SEL:MS;type:SEL:TEXT"
  eval <url> <js-file> [readySel]             — eval async JS file in page after load, print JSON result
"""

async def shot():
    url, out, w, h = sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
    actions = sys.argv[6] if len(sys.argv) > 6 else ""
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": w, "height": h}, device_scale_factor=2)
        errors = []
        pg.on("console", lambda m: errors.append("console." + m.type + ": " + m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        await pg.goto(url, wait_until="networkidle")
        await pg.wait_for_timeout(700)
        for act in [a for a in actions.split(";") if a.strip()]:
            kind, _, rest = act.partition(":")
            sel, _, arg = rest.partition(":")
            try:
                if kind == "hover":
                    await pg.hover(sel, timeout=3000); await pg.wait_for_timeout(int(arg or 500))
                elif kind == "click":
                    await pg.click(sel, timeout=3000); await pg.wait_for_timeout(int(arg or 500))
                elif kind == "type":
                    await pg.fill(sel, arg); await pg.wait_for_timeout(400)
            except Exception as e:
                errors.append(f"action {kind} {sel}: {e}")
        await pg.screenshot(path=out)
        await b.close()
        for e in errors[:12]: print("JS-ERR:", e, file=sys.stderr)

async def ev():
    url, jsfile = sys.argv[2], sys.argv[3]
    ready = sys.argv[4] if len(sys.argv) > 4 else ""
    src = open(jsfile).read()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 800, "height": 600}, device_scale_factor=2)
        errors = []
        pg.on("console", lambda m: errors.append("console." + m.type + ": " + m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        await pg.goto(url, wait_until="networkidle")
        if ready:
            try: await pg.wait_for_selector(ready, timeout=4000)
            except Exception as e: errors.append(f"ready {ready}: {e}")
        await pg.wait_for_timeout(400)
        res = await pg.evaluate(f"async () => {{ {src} }}")
        print(json.dumps(res, ensure_ascii=False, indent=1))
        for e in errors[:12]: print("JS-ERR:", e, file=sys.stderr)
        await b.close()

cmd = sys.argv[1] if len(sys.argv) > 1 else ""
if cmd == "shot": asyncio.run(shot())
elif cmd == "eval": asyncio.run(ev())
else: print(USAGE)
