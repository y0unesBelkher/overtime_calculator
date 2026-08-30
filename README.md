# Odoo Overtime Calculator — Chrome Extension

A Google Chrome Extension (Manifest V3) designed to seamlessly fetch overtime records from a self-hosted Odoo ERP instance, compute overtime pay based on employee salary and overtime multipliers, and display detailed breakdowns with date filtering and CSV export.

---

## 🎯 Features

- **Automated Odoo Integration**: Directly communicates with Odoo JSON-RPC endpoints (`search_read` & `read`) using active browser session cookies without requiring extra login credentials.
- **Accurate Pay Calculations**:
  - **Holiday Overtime**: `Hours × Hourly Rate × 3`
  - **At Work Overtime**: `Hours × Hourly Rate × 2`
  - **At Home Overtime**: `Hours × Hourly Rate × 1`
  - **Hourly Rate Formula**: `Monthly Salary ÷ (8 hrs/day × 22 work days) = Monthly Salary ÷ 176`
- **Date Filtering**:
  - Quick 1-click **Month Selector** (Jan–Dec) with Year navigation.
  - **Custom Date Range** picker (From / To).
  - Client-side date boundary filtering ensuring exact date matching.
- **Detailed Overtime Breakdown**:
  - Detailed table showing Date, Hours, Type, Status, and Calculated Pay.
  - Visual status badges color-coded by stage:
    - 🟡 **Draft**: `draft`
    - 🔵 **Manager Approval**: `manager_approval`
    - 🟢 **HR Approval / Approved**: `hr_approval`, `approved`, `confirmed`
    - 🔴 **Refused / Rejected**: `manager_refused`, `hr_refused`, `rejected`
- **Summary Dashboard**:
  - Total Overtime Pay.
  - Hourly rate indicator.
  - Side-by-side cards for Holiday, At Work, and At Home totals.
  - Total overtime hours.
- **Export & Share**:
  - **Export to CSV**: Download complete overtime reports with totals.
  - **Copy Summary**: Formatted text summary copied directly to clipboard.
- **In-Popup Settings & Monthly Salary Configuration**:
  - Set or change your **Monthly Salary** anytime directly inside the popup or via the options page.
  - Live preview of the calculated hourly rate (`Salary ÷ 176`).
  - Overtime figures automatically recalculate immediately upon saving new salary amounts.
  - Custom Odoo instance URL configuration.

---

## 📦 How to Load in Google Chrome

1. **Clone or Download** this repository to your local machine:
   ```bash
   git clone <repo-url>
   # or ensure you are in the project folder
   cd overtime_calculator
   ```

2. Open **Google Chrome** and navigate to the Extensions management page:
   - Type `chrome://extensions` in the address bar and press **Enter**.
   - Or click Chrome Menu (⋮) → **Extensions** → **Manage Extensions**.

3. Enable **Developer mode**:
   - Toggle the switch in the top right corner labeled **Developer mode**.

4. Load the unpacked extension:
   - Click the **Load unpacked** button in the top left.
   - Select the `overtime_calculator` directory.

5. **Pin the Extension**:
   - Click the puzzle icon (Extensions) in the Chrome toolbar.
   - Click the pin icon next to **Odoo Overtime Calculator** for quick access.

---

## 🚀 Usage Guide

1. **Initial Setup & Changing Salary**:
   - Click the extension icon.
   - Click the **⚙️ (Settings)** icon in the top right header to open settings at any time.
   - Enter or update your **Monthly Gross Salary** in LYD (e.g. `3000`).
   - The hourly rate preview updates in real-time as you type.
   - Enter your **Odoo Instance URL** (e.g. `https://odoo.yourcompany.com`).
   - Click **Save Settings** — your overtime earnings will immediately recalculate with the new rate!

2. **Calculate Overtime**:
   - Log into your Odoo instance in any Chrome tab.
   - Click the extension icon.
   - Select any month (e.g. **Jul**) or enter a custom date range.
   - View your total earnings and detailed day-by-day breakdown!

3. **Exporting Data**:
   - Click **Export CSV** to download a spreadsheet.
   - Click **Copy Summary** to paste a summary in chat or email.

---

## 📁 Project Structure

```
overtime_calculator/
├── manifest.json              # Chrome Manifest V3 configuration
├── popup.html                 # Extension popup interface & in-popup settings
├── popup.css                  # Modern dark theme styles with glassmorphism
├── settings.html              # Standalone options page
├── settings.css               # Settings styles
├── js/
│   ├── api.js                 # Odoo JSON-RPC API client & pagination handler
│   ├── calculator.js          # Pure calculation engine & business logic
│   ├── popup.js               # Popup UI controller & state management
│   └── settings.js            # Standalone settings controller
├── tests/
│   ├── calculator.test.html   # Browser-based test suite
│   └── run_tests.js           # Node.js automated test runner (36 unit tests)
├── icons/                     # Extension icons (16px, 48px, 128px)
└── README.md                  # Documentation
```

---

## 🧪 Running Unit Tests

Run the test suite with Node.js:
```bash
node tests/run_tests.js
```

All 36 unit tests cover constants, salary rates, multiplier calculations, line pay, summary aggregations, sorting, and CSV formatting.

---

## 👨‍💻 Author

Created by [y0unes](https://github.com/y0unesBelkher) © 2026
