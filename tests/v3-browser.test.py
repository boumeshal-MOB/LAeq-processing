from __future__ import annotations

import json
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    console_errors: list[str] = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda error: console_errors.append(str(error)))
    html = (ROOT / "index-v3.html").read_text(encoding="utf-8")
    css = (ROOT / "v3.css").read_text(encoding="utf-8")
    core = (ROOT / "v3-core.js").read_text(encoding="utf-8")
    app = (ROOT / "v3-app.js").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="v3.css">', f'<style>{css}</style>')
    html = html.replace('<script src="v3-core.js"></script>', f'<script>{core}</script>')
    html = html.replace('<script src="v3-app.js"></script>', f'<script>{app}</script>')
    page.set_content(html, wait_until="load")

    check(page.locator(".output-card").count() == 3, "Basic template should render three outputs")
    check("10 h" in page.locator(".output-card").nth(2).inner_text(), "Default calendar output must derive 10 h")
    check("Python" not in page.locator("body").inner_text(), "User-facing UI must not mention Python")

    page.locator('[data-panel="outputs"]').click()

    calendar = page.locator(".output-card").nth(2)
    calendar.locator('input[data-field="scheduleEnd"]').fill("19:00")
    calendar.locator('input[data-field="scheduleEnd"]').dispatch_event("change")
    calendar = page.locator(".output-card").nth(2)
    check("12 h" in calendar.inner_text(), "Calendar duration must update automatically to 12 h")
    check(calendar.locator('input[data-field="duration"]').count() == 0, "Calendar must not expose an editable duration input")

    first = page.locator(".output-card").first
    first.locator('select[data-field="active"]').select_option("false")
    first = page.locator(".output-card").first
    check("inactive" in (first.get_attribute("class") or ""), "Inactive output must receive inactive class")
    check(first.locator('input[data-field="variableName"]').is_disabled(), "Inactive output fields must be disabled")
    check(not first.locator('select[data-field="active"]').is_disabled(), "Active selector must remain enabled")
    check(not first.locator('[data-remove]').is_disabled(), "Remove must remain enabled")
    background = first.evaluate("el => getComputedStyle(el).backgroundColor")
    check(background != "rgb(255, 255, 255)", "Inactive card must be visibly greyed")
    before = page.locator(".output-card").count()
    first.locator('[data-remove]').click()
    check(page.locator(".output-card").count() == before - 1, "Inactive output must be removable without reactivation")

    page.locator("#templateSelect").select_option("france")
    page.locator("#applyTemplate").click()
    check(page.locator("#timeZone").input_value() == "Europe/Paris", "France template must select Europe/Paris")
    check(page.locator(".output-card").count() == 3, "France template must create three recurring period outputs")
    texts = [page.locator(".output-card").nth(i).inner_text() for i in range(3)]
    check(any("15 h" in text and "Mon–Sat" in text for text in texts), "France day period must be 07:00–22:00 Mon–Sat")
    check(any("9 h" in text and "22:00–07:00" in text and "Every day" in text for text in texts), "France night period must be 9 h every day")
    check(any("15 h" in text and "07:00–22:00" in text and "Sun" in text for text in texts), "France Sunday daytime block must cover 07:00–22:00")

    page.locator("#templateSelect").select_option("uk")
    page.locator("#applyTemplate").click()
    check(page.locator("#timeZone").input_value() == "Europe/London", "UK template must select Europe/London")
    check(page.locator(".output-card").count() == 2, "UK template must create two outputs")
    uk_day = page.locator(".output-card").nth(0).inner_text()
    uk_night = page.locator(".output-card").nth(1).inner_text()
    check("1 h fixed window" in uk_day and "07:00–23:00" in uk_day, "UK day output must be 1 h within 07:00–23:00")
    check("15 min fixed window" in uk_night and "23:00–07:00" in uk_night, "UK night output must be 15 min within 23:00–07:00")

    expected = {
        "ireland": (4, "Europe/Dublin", ["12 h", "4 h", "8 h"]),
        "spain": (3, "Europe/Madrid", ["12 h", "4 h", "8 h"]),
        "italy": (3, "Europe/Rome", ["16 h", "8 h"]),
    }
    for template_id, (count, timezone, markers) in expected.items():
        page.locator("#templateSelect").select_option(template_id)
        page.locator("#applyTemplate").click()
        check(page.locator(".output-card").count() == count, f"{template_id} output count")
        check(page.locator("#timeZone").input_value() == timezone, f"{template_id} timezone")
        body = page.locator("#outputList").inner_text()
        for marker in markers:
            check(marker in body, f"{template_id} must show {marker}")

    page.locator('[data-panel="execution"]').click()
    page.locator("#customExecution").check()
    check(page.locator("#customFrequency").input_value() == "", "Custom execution interval must remain empty")
    check("Enter a custom run interval" in page.locator("#executionWarning").inner_text(), "Empty custom schedule must show validation")
    page.locator("#customFrequency").fill("5")
    check("Every 5 min" in page.locator("#executionSummary").inner_text(), "Custom execution summary must update")

    check(not console_errors, "Browser runtime errors: " + json.dumps(console_errors))
    browser.close()
    print("PASS: 30 browser interaction, calendar coherence, disabled-state and country-template checks")
