from playwright.sync_api import sync_playwright
import os

def verify_coloring_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Listen for console logs
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PageError: {exc}"))

        print("Navigating...")
        page.goto("http://localhost:4173/")

        print("Waiting for canvas...")
        try:
            page.wait_for_selector("canvas", timeout=5000)
            print("Canvas found.")
        except Exception as e:
            print(f"Canvas not found: {e}")
            page.screenshot(path="verification/error_state.png")
            return

        # Check for Coloring Rules UI
        try:
            page.wait_for_selector("text=Coloring Rule")
            print("UI found.")
        except Exception as e:
             print(f"UI not found: {e}")
             page.screenshot(path="verification/error_state_ui.png")
             return

        # Find the select associated with Coloring Rule
        select_loc = page.locator("text=Coloring Rule").locator("xpath=..").locator("select")

        print("Selecting Randomize...")
        select_loc.select_option("random")
        page.wait_for_timeout(1000)
        page.screenshot(path="verification/random_coloring.png")
        print("Screenshot saved to verification/random_coloring.png")

        print("Selecting 4-Color...")
        select_loc.select_option("four-color")
        page.wait_for_timeout(1000)
        page.screenshot(path="verification/four_color.png")
        print("Screenshot saved to verification/four_color.png")

        print("Selecting Gradient...")
        select_loc.select_option("orientation-gradient")
        page.wait_for_timeout(1000)
        page.screenshot(path="verification/gradient.png")
        print("Screenshot saved to verification/gradient.png")

        browser.close()

if __name__ == "__main__":
    verify_coloring_ui()
