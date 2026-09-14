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

suite("Multiple lines per overtime & Same-date entries", (test) => {
  const rate = 10; // 10 LYD/hr

  test("Multiple lines with exact same date and same type calculate correctly", () => {
    const multiLinesSameDate = [
      { id: 101, overtime_hours: 3.5, overtime_type: "at_work", overtime_date: "2026-07-20", start_hour: "2026-07-20 08:00:00", end_hour: "2026-07-20 11:30:00" },
      { id: 102, overtime_hours: 4.5, overtime_type: "at_work", overtime_date: "2026-07-20", start_hour: "2026-07-20 13:00:00", end_hour: "2026-07-20 17:30:00" },
    ];
    const s = calc.calculateSummary(multiLinesSameDate, rate);
    assertClose(s.totalHours, 8.0, 0.001, "totalHours mismatch");
    assertClose(s.atWorkHours, 8.0, 0.001, "atWorkHours mismatch");
    assertClose(s.totalPay, 160.0, 0.001, "totalPay mismatch (8 * 10 * 2)");
    assertClose(s.atWorkPay, 160.0, 0.001, "atWorkPay mismatch");
    assert(s.entries.length === 2, "Both lines must be preserved in entries");
  });

  test("Multiple lines with same date but different overtime types", () => {
    const mixedTypesSameDate = [
      { id: 201, overtime_hours: 2, overtime_type: "holidays", overtime_date: "2026-07-24", start_hour: "2026-07-24 10:00:00" },
      { id: 202, overtime_hours: 3, overtime_type: "at_work", overtime_date: "2026-07-24", start_hour: "2026-07-24 13:00:00" },
      { id: 203, overtime_hours: 1.5, overtime_type: "at_home", overtime_date: "2026-07-24", start_hour: "2026-07-24 19:00:00" },
    ];
    const s = calc.calculateSummary(mixedTypesSameDate, rate);
    assertClose(s.totalHours, 6.5, 0.001);
    assertClose(s.holidayHours, 2.0, 0.001);
    assertClose(s.holidayPay, 60.0, 0.001); // 2 * 10 * 3
    assertClose(s.atWorkHours, 3.0, 0.001);
    assertClose(s.atWorkPay, 60.0, 0.001);  // 3 * 10 * 2
    assertClose(s.atHomeHours, 1.5, 0.001);
    assertClose(s.atHomePay, 15.0, 0.001);  // 1.5 * 10 * 1
    assertClose(s.totalPay, 135.0, 0.001);  // 60 + 60 + 15
    assert(s.entries.length === 3);
  });

  test("Multiple lines with identical data are all preserved and calculated", () => {
    const duplicateDataLines = [
      { id: 301, overtime_hours: 4, overtime_type: "at_work", overtime_date: "2026-07-15" },
      { id: 302, overtime_hours: 4, overtime_type: "at_work", overtime_date: "2026-07-15" },
    ];
    const s = calc.calculateSummary(duplicateDataLines, rate);
    assertClose(s.totalHours, 8.0, 0.001);
    assertClose(s.totalPay, 160.0, 0.001);
    assert(s.entries.length === 2);
    assert(s.entries[0].id === 301 && s.entries[1].id === 302);
  });

  test("State mapping properly propagates to all lines from the same parent overtime", () => {
    const linesFromSameParent = [
      { id: 401, overtime_hours: 2, overtime_type: "holidays", overtime_date: "2026-07-01" },
      { id: 402, overtime_hours: 3, overtime_type: "at_work", overtime_date: "2026-07-02" },
      { id: 403, overtime_hours: 4, overtime_type: "holidays", overtime_date: "2026-07-03" },
    ];
    // All 3 line IDs come from a single parent overtime with state 'approved'
    const parentStateMap = { 401: "approved", 402: "approved", 403: "approved" };
    const s = calc.calculateSummary(linesFromSameParent, rate, parentStateMap);
    assert(s.entries.every(e => e.state === "approved"), "All lines must reflect parent approved state");
  });

  test("Deterministic sorting by date, then startHour, then id", () => {
    const unsortedLines = [
      { id: 503, overtime_hours: 1, overtime_type: "at_work", overtime_date: "2026-07-20", start_hour: "2026-07-20 18:00:00" },
      { id: 501, overtime_hours: 2, overtime_type: "at_work", overtime_date: "2026-07-20", start_hour: "2026-07-20 09:00:00" },
      { id: 502, overtime_hours: 3, overtime_type: "at_work", overtime_date: "2026-07-20", start_hour: "2026-07-20 14:00:00" },
      { id: 500, overtime_hours: 4, overtime_type: "at_work", overtime_date: "2026-07-10", start_hour: "2026-07-10 10:00:00" },
    ];
    const s = calc.calculateSummary(unsortedLines, rate);
    assert(s.entries[0].id === 500, "First should be July 10");
    assert(s.entries[1].id === 501, "Second should be July 20 at 09:00");
    assert(s.entries[2].id === 502, "Third should be July 20 at 14:00");
    assert(s.entries[3].id === 503, "Fourth should be July 20 at 18:00");
  });

  test("CSV export correctly includes multiple lines with same date", () => {
    const summary = calc.calculateSummary([
      { id: 601, overtime_hours: 3, overtime_type: "holidays", overtime_date: "2026-07-24" },
      { id: 602, overtime_hours: 2, overtime_type: "at_work", overtime_date: "2026-07-24" },
    ], rate, { 601: "approved", 602: "approved" });
    const csv = calc.generateCSV(summary);
    assert(csv.includes("90.00"), "Holiday line pay (3 * 10 * 3 = 90)");
    assert(csv.includes("40.00"), "At-work line pay (2 * 10 * 2 = 40)");
    assert(csv.includes("130.00"), "Total pay (90 + 40 = 130)");
  });
});

suite("Status Breakdown & State Grouping", (test) => {
  const rate = 10; // 10 LYD/hr

  test("getStateLabel() returns correct labels", () => {
    assert(calc.getStateLabel("draft") === "Draft");
    assert(calc.getStateLabel("manager_approval") === "Manager Approval");
    assert(calc.getStateLabel("manager_refused") === "Manager Refused");
    assert(calc.getStateLabel("hr_approval") === "HR Approval");
    assert(calc.getStateLabel("hr_refused") === "HR Refused");
    assert(calc.getStateLabel("approved") === "Approved");
    assert(calc.getStateLabel("confirmed") === "Confirmed");
    assert(calc.getStateLabel("rejected") === "Rejected");
    assert(calc.getStateLabel(null) === "—");
    assert(calc.getStateLabel("custom_state") === "Custom State");
  });

  test("stateBreakdown groups hours and pay accurately per status", () => {
    const lines = [
      { id: 1, overtime_hours: 2, overtime_type: "holidays", overtime_date: "2026-08-01" }, // 2 * 10 * 3 = 60
      { id: 2, overtime_hours: 3, overtime_type: "at_work", overtime_date: "2026-08-02" },  // 3 * 10 * 2 = 60
      { id: 3, overtime_hours: 4, overtime_type: "at_home", overtime_date: "2026-08-03" },  // 4 * 10 * 1 = 40
      { id: 4, overtime_hours: 5, overtime_type: "at_work", overtime_date: "2026-08-04" },  // 5 * 10 * 2 = 100
      { id: 5, overtime_hours: 1, overtime_type: "holidays", overtime_date: "2026-08-05" }, // 1 * 10 * 3 = 30
    ];
    const stateMap = {
      1: "draft",
      2: "draft",
      3: "manager_approval",
      4: "hr_approval",
      5: "manager_refused",
    };

    const s = calc.calculateSummary(lines, rate, stateMap);
    const bd = s.stateBreakdown;

    // draft: 2h (60) + 3h (60) = 5h, 120 LYD
    assertClose(bd["draft"].hours, 5, 0.001);
    assertClose(bd["draft"].pay, 120, 0.001);
    assert(bd["draft"].count === 2);
    assert(bd["draft"].label === "Draft");

    // manager_approval: 4h, 40 LYD
    assertClose(bd["manager_approval"].hours, 4, 0.001);
    assertClose(bd["manager_approval"].pay, 40, 0.001);
    assert(bd["manager_approval"].count === 1);

    // hr_approval: 5h, 100 LYD
    assertClose(bd["hr_approval"].hours, 5, 0.001);
    assertClose(bd["hr_approval"].pay, 100, 0.001);
    assert(bd["hr_approval"].count === 1);

    // manager_refused: 1h, 30 LYD
    assertClose(bd["manager_refused"].hours, 1, 0.001);
    assertClose(bd["manager_refused"].pay, 30, 0.001);
    assert(bd["manager_refused"].count === 1);

    // States not in lines must NOT be present
    assert(bd["approved"] === undefined, "Unrepresented state 'approved' should not exist");
    assert(bd["hr_refused"] === undefined, "Unrepresented state 'hr_refused' should not exist");
  });

  test("CSV includes status breakdown section", () => {
    const lines = [
      { id: 1, overtime_hours: 2, overtime_type: "holidays", overtime_date: "2026-08-01" },
      { id: 2, overtime_hours: 3, overtime_type: "at_work", overtime_date: "2026-08-02" },
    ];
    const stateMap = { 1: "hr_approval", 2: "hr_refused" };
    const s = calc.calculateSummary(lines, rate, stateMap);
    const csv = calc.generateCSV(s);

    assert(csv.includes("STATUS BREAKDOWN"), "CSV must include status breakdown header");
    assert(csv.includes("HR Approval"), "CSV must include HR Approval");
    assert(csv.includes("HR Refused"), "CSV must include HR Refused");
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
