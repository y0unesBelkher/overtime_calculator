/**
 * Odoo Overtime Calculator — API Layer
 *
 * Handles all JSON-RPC communication with the Odoo instance.
 * Uses the browser's session cookie for authentication.
 */

// ─── JSON-RPC Helpers ────────────────────────────────────────────────────────

let _rpcIdCounter = Math.floor(Math.random() * 1_000_000);

/**
 * Generate a unique JSON-RPC request ID.
 */
function nextRpcId() {
  return ++_rpcIdCounter;
}

/**
 * Execute a raw JSON-RPC call against the Odoo instance.
 *
 * @param {string} baseUrl — Odoo base URL (e.g. "https://odoo.example.com")
 * @param {string} endpoint — Relative endpoint path (e.g. "/web/dataset/search_read")
 * @param {object} params — The `params` object for the JSON-RPC body
 * @returns {Promise<any>} The `result` field from the JSON-RPC response
 * @throws {Error} On network errors, HTTP errors, or JSON-RPC errors
 */
async function rpcCall(baseUrl, endpoint, params) {
  const url = `${baseUrl.replace(/\/+$/, "")}${endpoint}`;
  const body = {
    jsonrpc: "2.0",
    method: "call",
    id: nextRpcId(),
    params,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // send session cookie
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new OdooAuthError(
        "Session expired. Please log into Odoo and try again.",
      );
    }
    throw new OdooNetworkError(
      `HTTP ${response.status}: ${response.statusText}`,
    );
  }

  const data = await response.json();

  if (data.error) {
    const msg =
      data.error.data?.message || data.error.message || "Unknown RPC error";
    if (
      msg.includes("Session") ||
      msg.includes("login") ||
      msg.includes("access")
    ) {
      throw new OdooAuthError(msg);
    }
    throw new OdooRpcError(msg);
  }

  return data.result;
}

// ─── Custom Error Types ──────────────────────────────────────────────────────

class OdooAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "OdooAuthError";
  }
}

class OdooNetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = "OdooNetworkError";
  }
}

class OdooRpcError extends Error {
  constructor(message) {
    super(message);
    this.name = "OdooRpcError";
  }
}

// ─── Odoo API Functions ──────────────────────────────────────────────────────

const SEARCH_READ_BATCH_SIZE = 80;

/**
 * Fetch overtime parent records for the current logged-in employee.
 *
 * Uses `/web/dataset/search_read` on `hr.masarat.overtime`.
 * Odoo's record rule automatically enforces that regular users only receive
 * their own employee records. We search with a wide window around the target
 * dates so that overtime worked in a month is not missed if the request was
 * submitted in a different month (e.g. submitted in September for August work).
 *
 * @param {string} baseUrl
 * @param {string} startDate — ISO date "YYYY-MM-DD"
 * @param {string} endDate   — ISO date "YYYY-MM-DD"
 * @returns {Promise<Array<{
 *   id: number,
 *   employee_id: [number, string],
 *   overtime_total_hours: number,
 *   state: string,
 *   overtime_line_ids: number[],
 *   request_date: string
 * }>>}
 */
async function fetchOvertimeRecords(baseUrl, startDate, endDate) {
  const [sYear] = startDate.split("-").map(Number);
  const [eYear] = endDate.split("-").map(Number);
  const windowStart = `${sYear - 1}-10-01`;
  const windowEnd = `${eYear + 1}-04-01`;

  const domain = [
    ["request_date", ">=", windowStart],
    ["request_date", "<=", windowEnd],
  ];
  const fields = [
    "employee_id",
    "overtime_total_hours",
    "state",
    "overtime_line_ids",
    "request_date",
  ];

  let allRecords = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await rpcCall(baseUrl, "/web/dataset/search_read", {
      model: "hr.masarat.overtime",
      domain,
      fields,
      limit: SEARCH_READ_BATCH_SIZE,
      offset,
      sort: "request_date asc",
      context: {},
    });

    const records = result.records || [];
    allRecords = allRecords.concat(records);

    // Check if search_read returned overtime_line_ids
    // Some Odoo versions don't return One2many fields in search_read
    const hasLineIds =
      records.length > 0 && Array.isArray(records[0].overtime_line_ids);

    // If One2many not returned, we need the fallback flow (fetch parent details)
    if (!hasLineIds && records.length > 0) {
      // Fetch full parent records to get overtime_line_ids
      const parentIds = records.map((r) => r.id);
      const parentDetails = await fetchParentDetails(baseUrl, parentIds);

      // Merge overtime_line_ids back into allRecords
      const detailMap = {};
      parentDetails.forEach((d) => {
        detailMap[d.id] = Array.isArray(d.overtime_line_ids)
          ? d.overtime_line_ids
          : [];
      });
      allRecords.forEach((r) => {
        if (!Array.isArray(r.overtime_line_ids)) {
          r.overtime_line_ids = detailMap[r.id] || [];
        }
      });
    }

    // Check if there are more pages
    if (
      records.length < SEARCH_READ_BATCH_SIZE ||
      allRecords.length >= (result.length || Infinity)
    ) {
      hasMore = false;
    } else {
      offset += SEARCH_READ_BATCH_SIZE;
    }
  }

  return allRecords;
}

/**
 * Fallback: fetch parent overtime records by ID to get overtime_line_ids.
 *
 * @param {string} baseUrl
 * @param {number[]} ids
 * @returns {Promise<Array<{ id: number, overtime_line_ids: number[] }>>}
 */
async function fetchParentDetails(baseUrl, ids) {
  if (ids.length === 0) return [];

  const result = await rpcCall(
    baseUrl,
    "/web/dataset/call_kw/hr.masarat.overtime/read",
    {
      model: "hr.masarat.overtime",
      method: "read",
      args: [ids, ["overtime_line_ids"]],
      kwargs: { context: {} },
    },
  );

  return result;
}

/**
 * Fetch overtime line details by their IDs.
 *
 * @param {string} baseUrl
 * @param {number[]} lineIds
 * @returns {Promise<Array<{
 *   id: number,
 *   overtime_type: string,
 *   start_hour: string,
 *   end_hour: string,
 *   overtime_date: string,
 *   overtime_hours: number,
 *   description: string|boolean
 * }>>}
 */
async function fetchOvertimeLines(baseUrl, lineIds) {
  if (lineIds.length === 0) return [];

  const result = await rpcCall(
    baseUrl,
    "/web/dataset/call_kw/hr.masarat.overtime.line/read",
    {
      model: "hr.masarat.overtime.line",
      method: "read",
      args: [lineIds],
      kwargs: { context: {} },
    },
  );

  return result;
}

// ─── High-Level API ──────────────────────────────────────────────────────────

/**
 * Fetch and assemble all overtime data for a date range.
 *
 * 1. Fetches parent overtime records for the logged-in user (enforcing Odoo employee security).
 * 2. Collects all line IDs across the user's overtime requests.
 * 3. Batch-reads line details.
 * 4. Filters lines precisely by actual `overtime_date` (work date).
 *
 * @param {string} baseUrl
 * @param {string} startDate — "YYYY-MM-DD"
 * @param {string} endDate   — "YYYY-MM-DD"
 * @returns {Promise<{
 *   lines: Array<object>,
 *   stateMap: Record<number, string>,
 *   employeeName: string|null
 * }>}
 */
async function getOvertimeData(baseUrl, startDate, endDate) {
  // Step 1: Fetch parent records for the user
  const records = await fetchOvertimeRecords(baseUrl, startDate, endDate);

  if (records.length === 0) {
    return { lines: [], stateMap: {}, employeeName: null };
  }

  // Step 2: Collect all line IDs and build state map
  const allLineIds = [];
  const lineToState = {};
  let employeeName = null;

  records.forEach((record) => {
    if (record.employee_id && Array.isArray(record.employee_id)) {
      employeeName = record.employee_id[1];
    }
    const lineIds = Array.isArray(record.overtime_line_ids)
      ? record.overtime_line_ids
      : [];
    lineIds.forEach((lineId) => {
      allLineIds.push(lineId);
      lineToState[lineId] = record.state;
    });
  });

  if (allLineIds.length === 0) {
    return { lines: [], stateMap: {}, employeeName };
  }

  // Step 3: Fetch all line details in one batch
  const lines = await fetchOvertimeLines(baseUrl, allLineIds);

  // Step 4: Filter lines by their actual overtime_date (the date work was done)
  const filteredLines = lines.filter((line) => {
    return (
      line.overtime_date &&
      line.overtime_date >= startDate &&
      line.overtime_date <= endDate
    );
  });

  return {
    lines: filteredLines,
    stateMap: lineToState,
    employeeName,
  };
}

// ─── Settings Helpers ────────────────────────────────────────────────────────

/**
 * Load settings from chrome.storage.sync.
 *
 * @returns {Promise<{ salary: number|null, odooUrl: string }>}
 */
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      { salary: null, odooUrl: "" },
      (data) => resolve(data),
    );
  });
}

/**
 * Save settings to chrome.storage.sync.
 *
 * @param {{ salary?: number, odooUrl?: string }} settings
 * @returns {Promise<void>}
 */
async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, resolve);
  });
}

// ─── Exports ─────────────────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  window.OdooAPI = {
    rpcCall,
    fetchOvertimeRecords,
    fetchParentDetails,
    fetchOvertimeLines,
    getOvertimeData,
    loadSettings,
    saveSettings,
    OdooAuthError,
    OdooNetworkError,
    OdooRpcError,
  };
}
