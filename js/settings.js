/**
 * Odoo Overtime Calculator — Settings Page Controller
 *
 * Handles saving/loading salary and Odoo URL from chrome.storage.sync.
 */

(function () {
  "use strict";

  const api = window.OdooAPI;

  const HOURS_PER_MONTH = 176;

  const $form = document.getElementById("settings-form");
  const $salaryInput = document.getElementById("salary-input");
  const $urlInput = document.getElementById("url-input");
  const $ratePreview = document.getElementById("rate-preview");
  const $saveStatus = document.getElementById("save-status");

  // ─── Load existing settings ──────────────────────────────────────

  async function loadExisting() {
    const settings = await api.loadSettings();

    if (settings.salary) {
      $salaryInput.value = settings.salary;
      updateRatePreview(settings.salary);
    }

    if (settings.odooUrl) {
      $urlInput.value = settings.odooUrl;
    }
  }

  // ─── Rate preview ────────────────────────────────────────────────

  function updateRatePreview(salary) {
    if (salary && salary > 0) {
      const rate = salary / HOURS_PER_MONTH;
      $ratePreview.textContent = `→ Hourly rate: ${rate.toFixed(4)} LYD/hr`;
    } else {
      $ratePreview.textContent = "";
    }
  }

  $salaryInput.addEventListener("input", () => {
    const val = parseFloat($salaryInput.value);
    updateRatePreview(val);
  });

  // ─── Save ────────────────────────────────────────────────────────

  $form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const salary = parseFloat($salaryInput.value);
    let odooUrl = $urlInput.value.trim();

    // Validation
    if (!salary || salary <= 0) {
      $salaryInput.focus();
      return;
    }

    if (!odooUrl.startsWith("https://")) {
      $urlInput.focus();
      return;
    }

    // Remove trailing slash
    odooUrl = odooUrl.replace(/\/+$/, "");

    await api.saveSettings({ salary, odooUrl });

    // Show success
    $saveStatus.classList.remove("hidden");
    setTimeout(() => {
      $saveStatus.classList.add("hidden");
    }, 3000);
  });

  // ─── Init ────────────────────────────────────────────────────────

  loadExisting();
})();
