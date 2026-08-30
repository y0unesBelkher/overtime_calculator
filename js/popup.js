/**
 * Odoo Overtime Calculator — Popup Controller
 *
 * Manages the popup UI: date filtering, data fetching, rendering, inline settings, and exports.
 */

(function () {
  "use strict";

  const calc = window.OvertimeCalculator;
  const api = window.OdooAPI;

  const HOURS_PER_MONTH = 176;

  // ─── DOM References ──────────────────────────────────────────────

  // Views
  const $viewMain = document.getElementById("view-main");
  const $viewSettings = document.getElementById("view-settings");

  // Navigation & Settings
  const $settingsBtn = document.getElementById("settings-btn");
  const $settingsBackBtn = document.getElementById("settings-back-btn");
  const $openSettingsBtn = document.getElementById("open-settings-btn");

  // Settings form controls
  const $inpopupSettingsForm = document.getElementById("inpopup-settings-form");
  const $settingsSalary = document.getElementById("settings-salary");
  const $settingsOdooUrl = document.getElementById("settings-odoo-url");
  const $settingsRatePreview = document.getElementById("settings-rate-preview");
  const $settingsSaveStatus = document.getElementById("settings-save-status");

  // Filters
  const $yearDisplay = document.getElementById("year-display");
  const $yearPrev = document.getElementById("year-prev");
  const $yearNext = document.getElementById("year-next");
  const $monthBtns = document.querySelectorAll(".month-btn");
  const $dateFrom = document.getElementById("date-from");
  const $dateTo = document.getElementById("date-to");
  const $rangeBtn = document.getElementById("range-btn");
  const $retryBtn = document.getElementById("retry-btn");
  const $copyBtn = document.getElementById("copy-btn");
  const $csvBtn = document.getElementById("csv-btn");
  const $odooLink = document.getElementById("odoo-link");

  // State panels
  const $stateLoading = document.getElementById("state-loading");
  const $stateError = document.getElementById("state-error");
  const $stateSetup = document.getElementById("state-setup");
  const $stateEmpty = document.getElementById("state-empty");
  const $stateData = document.getElementById("state-data");

  // Data display elements
  const $totalPay = document.getElementById("total-pay");
  const $hourlyRate = document.getElementById("hourly-rate");
  const $holidayPay = document.getElementById("holiday-pay");
  const $holidayHours = document.getElementById("holiday-hours");
  const $atworkPay = document.getElementById("atwork-pay");
  const $atworkHours = document.getElementById("atwork-hours");
  const $athomePay = document.getElementById("athome-pay");
  const $athomeHours = document.getElementById("athome-hours");
  const $totalHours = document.getElementById("total-hours");
  const $tableBody = document.getElementById("table-body");
  const $employeeName = document.getElementById("employee-name");
  const $errorMessage = document.getElementById("error-message");

  // ─── State ───────────────────────────────────────────────────────

  let currentYear = new Date().getFullYear();
  let activeMonth = null; // null when using custom range
  let lastSummary = null; // last computed summary (for exports)
  let settings = { salary: null, odooUrl: "" };

  // ─── SVG Icons Helper ────────────────────────────────────────────

  const ICONS = {
    holiday: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
    atwork: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>`,
    athome: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  };

  // ─── Initialization ──────────────────────────────────────────────

  async function init() {
    settings = await api.loadSettings();
    $yearDisplay.textContent = currentYear;

    const $footerYear = document.getElementById("footer-year");
    if ($footerYear) $footerYear.textContent = new Date().getFullYear();

    if (!settings.salary || !settings.odooUrl) {
      showState("setup");
      return;
    }

    // Default to current month
    const currentMonth = new Date().getMonth();
    selectMonth(currentMonth);
  }

  // ─── View Management ─────────────────────────────────────────────

  function switchView(viewName) {
    if (viewName === "settings") {
      $viewMain.classList.add("hidden");
      $viewSettings.classList.remove("hidden");
      populateSettingsForm();
    } else {
      $viewSettings.classList.add("hidden");
      $viewMain.classList.remove("hidden");
    }
  }

  function populateSettingsForm() {
    if (settings.salary) {
      $settingsSalary.value = settings.salary;
      updateSettingsRatePreview(settings.salary);
    } else {
      $settingsSalary.value = "";
      updateSettingsRatePreview(null);
    }

    if (settings.odooUrl) {
      $settingsOdooUrl.value = settings.odooUrl;
    } else {
      $settingsOdooUrl.value = "";
    }
  }

  function updateSettingsRatePreview(salary) {
    if (salary && salary > 0) {
      const rate = salary / HOURS_PER_MONTH;
      $settingsRatePreview.textContent = `→ Calculated hourly rate: ${rate.toFixed(4)} LYD/hr`;
    } else {
      $settingsRatePreview.textContent = "";
    }
  }

  // ─── State Management ────────────────────────────────────────────

  function showState(state) {
    $stateLoading.classList.add("hidden");
    $stateError.classList.add("hidden");
    $stateSetup.classList.add("hidden");
    $stateEmpty.classList.add("hidden");
    $stateData.classList.add("hidden");

    switch (state) {
      case "loading":
        $stateLoading.classList.remove("hidden");
        break;
      case "error":
        $stateError.classList.remove("hidden");
        break;
      case "setup":
        $stateSetup.classList.remove("hidden");
        break;
      case "empty":
        $stateEmpty.classList.remove("hidden");
        break;
      case "data":
        $stateData.classList.remove("hidden");
        break;
    }
  }

  // ─── Date Helpers ────────────────────────────────────────────────

  function getMonthRange(year, month) {
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { start, end };
  }

  function formatStateLabel(state) {
    const labels = {
      draft: "Draft",
      manager_approval: "Manager Approval",
      manager_refused: "Manager Refused",
      hr_approval: "HR Approval",
      hr_refused: "HR Refused",
      approved: "Approved",
      confirmed: "Confirmed",
      rejected: "Rejected",
    };
    return labels[state] || (state ? state.replace(/_/g, " ") : "—");
  }

  // ─── Data Fetching ───────────────────────────────────────────────

  async function fetchAndRender(startDate, endDate) {
    showState("loading");

    try {
      const { lines, stateMap, employeeName } = await api.getOvertimeData(
        settings.odooUrl,
        startDate,
        endDate
      );

      if (lines.length === 0) {
        showState("empty");
        return;
      }

      const hourlyRate = calc.getHourlyRate(settings.salary);
      const summary = calc.calculateSummary(lines, hourlyRate, stateMap);
      lastSummary = summary;

      renderSummary(summary, employeeName);
      renderTable(summary);
      showState("data");
    } catch (err) {
      console.error("Overtime fetch error:", err);

      $errorMessage.textContent = err.message;

      if (err instanceof api.OdooAuthError) {
        $odooLink.href = settings.odooUrl;
        $odooLink.classList.remove("hidden");
      } else {
        $odooLink.classList.add("hidden");
      }

      showState("error");
    }
  }

  // ─── Rendering ───────────────────────────────────────────────────

  function renderSummary(summary, employeeName) {
    $totalPay.textContent = calc.formatCurrency(summary.totalPay);
    $hourlyRate.textContent = summary.hourlyRate.toFixed(2) + " LYD/hr";
    $holidayPay.textContent = calc.formatCurrency(summary.holidayPay);
    $holidayHours.textContent = calc.formatHours(summary.holidayHours);
    $atworkPay.textContent = calc.formatCurrency(summary.atWorkPay);
    $atworkHours.textContent = calc.formatHours(summary.atWorkHours);
    $athomePay.textContent = calc.formatCurrency(summary.atHomePay);
    $athomeHours.textContent = calc.formatHours(summary.atHomeHours);
    $totalHours.textContent = calc.formatHours(summary.totalHours);

    if (employeeName) {
      $employeeName.textContent = employeeName;
      $employeeName.title = employeeName;
    } else {
      $employeeName.textContent = "";
    }
  }

  function renderTable(summary) {
    $tableBody.innerHTML = "";

    summary.entries.forEach((entry) => {
      const tr = document.createElement("tr");

      // 1. Date cell
      const tdDate = document.createElement("td");
      tdDate.textContent = entry.date;
      tr.appendChild(tdDate);

      // 2. Hours cell
      const tdHours = document.createElement("td");
      tdHours.textContent = calc.formatHours(entry.hours);
      tr.appendChild(tdHours);

      // 3. Type cell with SVG icon
      const tdType = document.createElement("td");
      const typeBadge = document.createElement("span");
      let icon = ICONS.atwork;
      let badgeClass = "atwork";

      if (entry.type === "holidays") {
        icon = ICONS.holiday;
        badgeClass = "holiday";
      } else if (entry.type === "at_home") {
        icon = ICONS.athome;
        badgeClass = "athome";
      }

      typeBadge.className = `type-badge ${badgeClass}`;
      typeBadge.innerHTML = `${icon} ${entry.typeLabel}`;
      tdType.appendChild(typeBadge);
      tr.appendChild(tdType);

      // 4. Status badge cell
      const tdState = document.createElement("td");
      if (entry.state) {
        const badge = document.createElement("span");
        badge.className = `state-badge ${entry.state}`;
        badge.textContent = formatStateLabel(entry.state);
        tdState.appendChild(badge);
      } else {
        tdState.textContent = "—";
      }
      tr.appendChild(tdState);

      // 5. Pay cell
      const tdPay = document.createElement("td");
      tdPay.textContent = calc.formatCurrency(entry.pay);
      tr.appendChild(tdPay);

      $tableBody.appendChild(tr);
    });
  }

  // ─── Month Selection ─────────────────────────────────────────────

  function selectMonth(month) {
    activeMonth = month;

    // Clear custom range
    $dateFrom.value = "";
    $dateTo.value = "";

    // Highlight active month
    $monthBtns.forEach((btn) => {
      const m = parseInt(btn.dataset.month, 10);
      btn.classList.toggle("active", m === month);
    });

    const { start, end } = getMonthRange(currentYear, month);
    fetchAndRender(start, end);
  }

  // ─── Event Handlers ──────────────────────────────────────────────

  // Month buttons
  $monthBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const month = parseInt(btn.dataset.month, 10);
      selectMonth(month);
    });
  });

  // Year navigation
  $yearPrev.addEventListener("click", () => {
    currentYear--;
    $yearDisplay.textContent = currentYear;
    if (activeMonth !== null) {
      selectMonth(activeMonth);
    }
  });

  $yearNext.addEventListener("click", () => {
    currentYear++;
    $yearDisplay.textContent = currentYear;
    if (activeMonth !== null) {
      selectMonth(activeMonth);
    }
  });

  // Custom date range
  $rangeBtn.addEventListener("click", () => {
    const from = $dateFrom.value;
    const to = $dateTo.value;

    if (!from || !to) {
      showToast("Please select both dates");
      return;
    }

    if (from > to) {
      showToast("'From' date must be before 'To' date");
      return;
    }

    // Clear month selection
    activeMonth = null;
    $monthBtns.forEach((btn) => btn.classList.remove("active"));

    fetchAndRender(from, to);
  });

  // Open Settings view
  $settingsBtn.addEventListener("click", () => {
    switchView("settings");
  });

  $openSettingsBtn.addEventListener("click", () => {
    switchView("settings");
  });

  // Back from Settings view
  $settingsBackBtn.addEventListener("click", () => {
    switchView("main");
  });

  // Salary live rate preview in settings
  $settingsSalary.addEventListener("input", () => {
    const val = parseFloat($settingsSalary.value);
    updateSettingsRatePreview(val);
  });

  // Settings form submission
  $inpopupSettingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const salary = parseFloat($settingsSalary.value);
    let odooUrl = $settingsOdooUrl.value.trim();

    if (!salary || salary <= 0) {
      $settingsSalary.focus();
      return;
    }

    if (!odooUrl.startsWith("https://")) {
      $settingsOdooUrl.focus();
      return;
    }

    odooUrl = odooUrl.replace(/\/+$/, "");

    await api.saveSettings({ salary, odooUrl });
    settings = { salary, odooUrl };

    // Show temporary saved status
    $settingsSaveStatus.classList.remove("hidden");
    setTimeout(() => {
      $settingsSaveStatus.classList.add("hidden");
      switchView("main");

      // Reload data
      if (activeMonth !== null) {
        selectMonth(activeMonth);
      } else if ($dateFrom.value && $dateTo.value) {
        fetchAndRender($dateFrom.value, $dateTo.value);
      } else {
        const currentMonth = new Date().getMonth();
        selectMonth(currentMonth);
      }
    }, 900);
  });

  // Retry
  $retryBtn.addEventListener("click", () => {
    if (activeMonth !== null) {
      selectMonth(activeMonth);
    } else if ($dateFrom.value && $dateTo.value) {
      fetchAndRender($dateFrom.value, $dateTo.value);
    }
  });

  // Copy to clipboard
  $copyBtn.addEventListener("click", () => {
    if (!lastSummary) return;

    const lines = [`Overtime Summary (Rate: ${lastSummary.hourlyRate.toFixed(2)} LYD/hr)`, ""];
    lastSummary.entries.forEach((e) => {
      lines.push(
        `${e.date}  ${calc.formatHours(e.hours)}  ${e.typeLabel} (×${e.multiplier})  [${formatStateLabel(e.state)}]  ${calc.formatCurrency(e.pay)}`
      );
    });
    lines.push("");
    lines.push(`Holiday (×3):  ${calc.formatCurrency(lastSummary.holidayPay)} (${calc.formatHours(lastSummary.holidayHours)})`);
    lines.push(`At Work (×2):  ${calc.formatCurrency(lastSummary.atWorkPay)} (${calc.formatHours(lastSummary.atWorkHours)})`);
    if (lastSummary.atHomeHours > 0) {
      lines.push(`At Home (×1):  ${calc.formatCurrency(lastSummary.atHomePay)} (${calc.formatHours(lastSummary.atHomeHours)})`);
    }
    lines.push(`TOTAL:         ${calc.formatCurrency(lastSummary.totalPay)} (${calc.formatHours(lastSummary.totalHours)})`);

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      flashButton($copyBtn, "Copied!");
    });
  });

  // Export CSV
  $csvBtn.addEventListener("click", () => {
    if (!lastSummary) return;

    const csv = calc.generateCSV(lastSummary);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `overtime_${$dateFrom.value || "export"}_${$dateTo.value || new Date().toISOString().slice(0, 10)}.csv`;
    a.click();

    URL.revokeObjectURL(url);
    flashButton($csvBtn, "Exported!");
  });

  // ─── UI Helpers ──────────────────────────────────────────────────

  function flashButton(btn, text) {
    const originalHTML = btn.innerHTML;
    btn.classList.add("success");
    btn.innerHTML = `✓ ${text}`;
    setTimeout(() => {
      btn.classList.remove("success");
      btn.innerHTML = originalHTML;
    }, 1500);
  }

  function showToast(message) {
    let toast = document.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("visible");
    setTimeout(() => toast.classList.remove("visible"), 2500);
  }

  // ─── Boot ────────────────────────────────────────────────────────

  init();
})();
