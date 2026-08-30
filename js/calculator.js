/**
 * Odoo Overtime Calculator — Calculation Engine
 *
 * Pure business logic for computing overtime pay.
 * No DOM manipulation, no API calls — easily testable.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const WORK_HOURS_PER_DAY = 8;
const WORK_DAYS_PER_MONTH = 22;
const HOURS_PER_MONTH = WORK_HOURS_PER_DAY * WORK_DAYS_PER_MONTH; // 176

/**
 * Multiplier applied to the hourly rate for each overtime type.
 *   holidays → ×3  (public holidays, weekends, etc.)
 *   at_work  → ×2  (regular working-day overtime)
 */
const OVERTIME_MULTIPLIERS = {
  holidays: 3,
  at_work: 2,
  at_home: 1,
};

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Derive the hourly rate from a monthly salary.
 *
 * @param {number} monthlySalary — Gross monthly salary in LYD
 * @returns {number} Hourly rate (salary / 176)
 */
function getHourlyRate(monthlySalary) {
  if (typeof monthlySalary !== "number" || monthlySalary <= 0) {
    throw new Error("Monthly salary must be a positive number");
  }
  return monthlySalary / HOURS_PER_MONTH;
}

/**
 * Get the multiplier for a given overtime type.
 *
 * @param {string} overtimeType — "holidays" | "at_work"
 * @returns {number} The multiplier (3 or 2)
 * @throws {Error} If the overtime type is unknown
 */
function getMultiplier(overtimeType) {
  const multiplier = OVERTIME_MULTIPLIERS[overtimeType];
  if (multiplier === undefined) {
    throw new Error(`Unknown overtime type: "${overtimeType}"`);
  }
  return multiplier;
}

/**
 * Calculate pay for a single overtime line.
 *
 * @param {{ overtime_hours: number, overtime_type: string }} line
 * @param {number} hourlyRate
 * @returns {number} Pay in LYD
 */
function calculateLinePay(line, hourlyRate) {
  const multiplier = getMultiplier(line.overtime_type);
  return line.overtime_hours * hourlyRate * multiplier;
}

/**
 * Calculate a full summary for a collection of overtime lines.
 *
 * @param {Array<{
 *   overtime_hours: number,
 *   overtime_type: string,
 *   overtime_date: string,
 *   start_hour?: string,
 *   end_hour?: string,
 *   description?: string|boolean
 * }>} lines — Overtime line records from Odoo
 * @param {number} hourlyRate — Pre-computed hourly rate
 * @param {Object} [parentStateMap] — Optional map of lineId → parent state
 * @returns {{
 *   totalPay: number,
 *   totalHours: number,
 *   holidayHours: number,
 *   holidayPay: number,
 *   atWorkHours: number,
 *   atWorkPay: number,
 *   hourlyRate: number,
 *   entries: Array<{
 *     id: number,
 *     date: string,
 *     hours: number,
 *     type: string,
 *     typeLabel: string,
 *     multiplier: number,
 *     pay: number,
 *     state: string|null,
 *     startHour: string|null,
 *     endHour: string|null,
 *     description: string|null
 *   }>
 * }}
 */
function calculateSummary(lines, hourlyRate, parentStateMap = {}) {
  let totalPay = 0;
  let totalHours = 0;
  let holidayHours = 0;
  let holidayPay = 0;
  let atWorkHours = 0;
  let atWorkPay = 0;
  let atHomeHours = 0;
  let atHomePay = 0;

  const entries = lines.map((line) => {
    const multiplier = getMultiplier(line.overtime_type);
    const pay = line.overtime_hours * hourlyRate * multiplier;

    totalPay += pay;
    totalHours += line.overtime_hours;

    if (line.overtime_type === "holidays") {
      holidayHours += line.overtime_hours;
      holidayPay += pay;
    } else if (line.overtime_type === "at_work") {
      atWorkHours += line.overtime_hours;
      atWorkPay += pay;
    } else if (line.overtime_type === "at_home") {
      atHomeHours += line.overtime_hours;
      atHomePay += pay;
    }

    let typeLabel = "Other";
    if (line.overtime_type === "holidays") typeLabel = "Holiday";
    else if (line.overtime_type === "at_work") typeLabel = "At Work";
    else if (line.overtime_type === "at_home") typeLabel = "At Home";

    return {
      id: line.id,
      date: line.overtime_date,
      hours: line.overtime_hours,
      type: line.overtime_type,
      typeLabel,
      multiplier,
      pay,
      state: parentStateMap[line.id] || null,
      startHour: line.start_hour || null,
      endHour: line.end_hour || null,
      description:
        line.description && line.description !== false
          ? line.description
          : null,
    };
  });

  // Sort entries by date (ascending)
  entries.sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalPay,
    totalHours,
    holidayHours,
    holidayPay,
    atWorkHours,
    atWorkPay,
    atHomeHours,
    atHomePay,
    hourlyRate,
    entries,
  };
}

/**
 * Format a number as LYD currency.
 *
 * @param {number} amount
 * @returns {string} e.g. "1,245.50 LYD"
 */
function formatCurrency(amount) {
  return (
    amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " LYD"
  );
}

/**
 * Format hours to a readable string.
 *
 * @param {number} hours
 * @returns {string} e.g. "5.33h"
 */
function formatHours(hours) {
  return hours.toFixed(2) + "h";
}

/**
 * Generate CSV content from a summary.
 *
 * @param {ReturnType<typeof calculateSummary>} summary
 * @returns {string} CSV string
 */
function generateCSV(summary) {
  const headers = [
    "Date",
    "Hours",
    "Type",
    "Multiplier",
    "Hourly Rate",
    "Pay (LYD)",
    "State",
  ];
  const rows = summary.entries.map((entry) => [
    entry.date,
    entry.hours.toFixed(2),
    entry.typeLabel,
    `x${entry.multiplier}`,
    summary.hourlyRate.toFixed(4),
    entry.pay.toFixed(2),
    entry.state || "—",
  ]);

  // Add summary row
  rows.push([]);
  rows.push(["TOTAL", summary.totalHours.toFixed(2), "", "", "", summary.totalPay.toFixed(2), ""]);
  rows.push(["Holiday Total", summary.holidayHours.toFixed(2), "Holiday", "x3", "", summary.holidayPay.toFixed(2), ""]);
  rows.push(["At Work Total", summary.atWorkHours.toFixed(2), "At Work", "x2", "", summary.atWorkPay.toFixed(2), ""]);
  if (summary.atHomeHours > 0) {
    rows.push(["At Home Total", summary.atHomeHours.toFixed(2), "At Home", "x1", "", summary.atHomePay.toFixed(2), ""]);
  }

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  return csvContent;
}

// ─── Exports (for use in popup.js and tests) ────────────────────────────────

if (typeof window !== "undefined") {
  window.OvertimeCalculator = {
    WORK_HOURS_PER_DAY,
    WORK_DAYS_PER_MONTH,
    HOURS_PER_MONTH,
    OVERTIME_MULTIPLIERS,
    getHourlyRate,
    getMultiplier,
    calculateLinePay,
    calculateSummary,
    formatCurrency,
    formatHours,
    generateCSV,
  };
}
