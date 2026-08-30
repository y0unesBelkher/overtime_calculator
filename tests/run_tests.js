/**
 * Node.js test runner for calculator.js
 * Run with: node tests/run_tests.js
 */

// Simulate window for the calculator module
global.window = {};

// Load calculator
require("../js/calculator.js");

const calc = global.window.OvertimeCalculator;

let totalTests = 0;
let passed = 0;
let failed = 0;

function suite(name, fn) {
  console.log(`\n  \x1b[1m${name}\x1b[0m`);
  fn((testName, testFn) => {
    totalTests++;
    try {
      testFn();
      passed++;
      console.log(`    \x1b[32m✓\x1b[0m ${testName}`);
    } catch (e) {
      failed++;
      console.log(`    \x1b[31m✗\x1b[0m ${testName}`);
      console.log(`      \x1b[31m${e.message}\x1b[0m`);
    }
  });
}

function assert(cond, msg) { if (!cond) throw new Error(msg || "Assertion failed"); }
function assertClose(a, b, t, m) { if (Math.abs(a-b) > t) throw new Error(`${m}: expected ≈${b}, got ${a}`); }
function assertThrows(fn) { let threw = false; try { fn(); } catch(e) { threw = true; } if (!threw) throw new Error("Expected throw"); }

// ─── Tests ──────────────────────────────────────────────────────────

suite("Constants", (test) => {
  test("HOURS_PER_MONTH is 176", () => assert(calc.HOURS_PER_MONTH === 176));
  test("Holiday multiplier is 3", () => assert(calc.OVERTIME_MULTIPLIERS.holidays === 3));
  test("At-work multiplier is 2", () => assert(calc.OVERTIME_MULTIPLIERS.at_work === 2));
  test("At-home multiplier is 1", () => assert(calc.OVERTIME_MULTIPLIERS.at_home === 1));
});

suite("getHourlyRate()", (test) => {
  test("3000 LYD → 17.0454.../hr", () => assertClose(calc.getHourlyRate(3000), 3000/176, 0.0001));
  test("1760 LYD → exactly 10/hr", () => assert(calc.getHourlyRate(1760) === 10));
  test("Throws on zero", () => assertThrows(() => calc.getHourlyRate(0)));
  test("Throws on negative", () => assertThrows(() => calc.getHourlyRate(-500)));
  test("Throws on string", () => assertThrows(() => calc.getHourlyRate("3000")));
});

suite("getMultiplier()", (test) => {
  test("holidays → 3", () => assert(calc.getMultiplier("holidays") === 3));
  test("at_work → 2", () => assert(calc.getMultiplier("at_work") === 2));
  test("at_home → 1", () => assert(calc.getMultiplier("at_home") === 1));
  test("Throws on unknown", () => assertThrows(() => calc.getMultiplier("weekend")));
});

suite("calculateLinePay()", (test) => {
  const rate = calc.getHourlyRate(3000);
  test("5.333h holiday", () => assertClose(calc.calculateLinePay({ overtime_hours: 5.333333, overtime_type: "holidays" }, rate), 5.333333 * rate * 3, 0.01));
  test("4h at_work", () => assertClose(calc.calculateLinePay({ overtime_hours: 4, overtime_type: "at_work" }, rate), 4 * rate * 2, 0.01));
  test("3h at_home", () => assertClose(calc.calculateLinePay({ overtime_hours: 3, overtime_type: "at_home" }, rate), 3 * rate * 1, 0.01));
  test("0h → 0 pay", () => assert(calc.calculateLinePay({ overtime_hours: 0, overtime_type: "holidays" }, rate) === 0));
  test("Throws on unknown type", () => assertThrows(() => calc.calculateLinePay({ overtime_hours: 5, overtime_type: "x" }, rate)));
});

suite("calculateSummary()", (test) => {
  const rate = 10;
  const lines = [
    { id: 1, overtime_hours: 5, overtime_type: "holidays", overtime_date: "2026-07-24", description: false },
    { id: 2, overtime_hours: 4, overtime_type: "at_work", overtime_date: "2026-07-20", description: "X" },
    { id: 3, overtime_hours: 3, overtime_type: "holidays", overtime_date: "2026-07-25", description: false },
    { id: 4, overtime_hours: 2, overtime_type: "at_home", overtime_date: "2026-07-26", description: false },
  ];

  test("totalPay = 340", () => assertClose(calc.calculateSummary(lines, rate).totalPay, 340, 0.01));
  test("totalHours = 14", () => assertClose(calc.calculateSummary(lines, rate).totalHours, 14, 0.01));
  test("holidayHours = 8", () => assertClose(calc.calculateSummary(lines, rate).holidayHours, 8, 0.01));
  test("holidayPay = 240", () => assertClose(calc.calculateSummary(lines, rate).holidayPay, 240, 0.01));
  test("atWorkPay = 80", () => assertClose(calc.calculateSummary(lines, rate).atWorkPay, 80, 0.01));
  test("atHomeHours = 2", () => assertClose(calc.calculateSummary(lines, rate).atHomeHours, 2, 0.01));
  test("atHomePay = 20", () => assertClose(calc.calculateSummary(lines, rate).atHomePay, 20, 0.01));
  test("Sorted by date asc", () => {
    const s = calc.calculateSummary(lines, rate);
    assert(s.entries[0].date === "2026-07-20");
    assert(s.entries[3].date === "2026-07-26");
  });
  test("false description → null", () => assert(calc.calculateSummary(lines, rate).entries.find(e => e.id === 1).description === null));
  test("String description preserved", () => assert(calc.calculateSummary(lines, rate).entries.find(e => e.id === 2).description === "X"));
  test("Empty lines → zeros", () => {
    const s = calc.calculateSummary([], rate);
    assert(s.totalPay === 0 && s.entries.length === 0);
  });
});

suite("formatCurrency()", (test) => {
  test("1245.5 → '1,245.50 LYD'", () => assert(calc.formatCurrency(1245.5) === "1,245.50 LYD"));
  test("0 → '0.00 LYD'", () => assert(calc.formatCurrency(0) === "0.00 LYD"));
});

suite("formatHours()", (test) => {
  test("5.333 → '5.33h'", () => assert(calc.formatHours(5.333) === "5.33h"));
  test("4 → '4.00h'", () => assert(calc.formatHours(4) === "4.00h"));
});

suite("generateCSV()", (test) => {
  const summary = calc.calculateSummary([
    { id: 1, overtime_hours: 5, overtime_type: "holidays", overtime_date: "2026-07-24", description: false },
    { id: 2, overtime_hours: 4, overtime_type: "at_work", overtime_date: "2026-07-20", description: false },
  ], 10, { 1: "approved", 2: "hr_approval" });

  test("Contains header", () => { const csv = calc.generateCSV(summary); assert(csv.includes("Date") && csv.includes("Pay (LYD)")); });
  test("Contains pay values", () => { const csv = calc.generateCSV(summary); assert(csv.includes("150.00") && csv.includes("80.00")); });
  test("Contains total", () => assert(calc.generateCSV(summary).includes("230.00")));
});

// ─── Summary ────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
if (failed === 0) {
  console.log(`\x1b[32m  All ${totalTests} tests passed ✓\x1b[0m\n`);
} else {
  console.log(`\x1b[31m  ${failed} of ${totalTests} tests failed ✗\x1b[0m\n`);
  process.exit(1);
}
