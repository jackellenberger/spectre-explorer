from playwright.sync_api import sync_playwright

def verify_editor():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PageError: {exc}"))

        print("Navigating...")
        page.goto("http://localhost:4173/")

        try:
            page.wait_for_selector("canvas", timeout=5000)
        except:
            print("Canvas not found")
            page.screenshot(path="verification/error_start.png")
            return

        # Find the select associated with Coloring Rule
        select_loc = page.locator("text=Coloring Rule").locator("xpath=..").locator("select")

        print("Selecting Gradient...")
        select_loc.select_option("orientation-gradient")
        page.wait_for_timeout(500)

        # Click Edit Rule
        print("Opening Editor...")
        page.click("button[title='Edit Rule']")
        page.wait_for_selector("text=Edit Gradient", timeout=2000)

        page.screenshot(path="verification/editor_gradient.png")
        print("Screenshot: verification/editor_gradient.png")

        # Close editor (Cancel)
        page.click("text=Cancel")
        page.wait_for_timeout(500)

        print("Selecting Orientation...")
        select_loc.select_option("orientation")
        page.wait_for_timeout(500)

        # Click Edit Rule
        page.click("button[title='Edit Rule']")
        page.wait_for_selector("text=Edit Orientation Colors", timeout=2000)

        page.screenshot(path="verification/editor_orientation.png")
        print("Screenshot: verification/editor_orientation.png")

        browser.close()

if __name__ == "__main__":
    verify_editor()
