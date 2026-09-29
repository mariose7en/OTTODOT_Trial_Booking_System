/**
 * Programmable in-memory stand-in for `@/lib/supabase`.
 *
 * Supports the exact query-builder surface used by the booking/payment routes:
 *   from(t).select(cols?, opts?).eq(col, val)*.order(col, opts)?.single()
 *   from(t).insert(payload)[.select().single()]
 *   from(t).update(payload).eq(col, val)*
 *   rpc(name, params)
 *
 * Behaviour is deterministic:
 *   - programmed responses (`program` / `programRpc`) are consumed first, in FIFO order;
 *   - `passThrough: true` means "use the default behaviour for this call";
 *   - otherwise rows are filtered/inserted/updated in an in-memory table, including
 *     a `duplicate key` error when an insert reuses an existing `id` (PK simulation).
 *
 * Every executed call is recorded in `calls` so tests can assert the contract
 * (which tables, which filters, how many queries — e.g. N+1 counting).
 */

export interface ProgrammedResponse {
  data?: unknown;
  error?: unknown;
  count?: number | null;
  passThrough?: boolean;
}

type FilterOp = "eq" | "gte" | "lt" | "in";
type Filter = [column: string, value: unknown, op?: FilterOp];

export interface RecordedCall {
  source: "from" | "rpc";
  table?: string;
  name?: string;
  op?: string;
  filters?: Filter[];
  columns?: unknown;
  payload?: unknown;
  params?: unknown;
}

export interface SeedTables {
  [table: string]: any[];
}

function resolvePath(row: any, path: string): unknown {
  if (Object.prototype.hasOwnProperty.call(row, path)) return row[path];
  if (!path.includes(".")) return undefined;
  let cursor: any = row;
  for (const part of path.split(".")) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function compareValues(left: any, right: any): number {
  if (left == null || right == null) return NaN;
  if (left instanceof Date || right instanceof Date) {
    return new Date(left).getTime() - new Date(right).getTime();
  }
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "string" && typeof right === "string") {
    const lt = Date.parse(left);
    const rt = Date.parse(right);
    if (!Number.isNaN(lt) && !Number.isNaN(rt)) return lt - rt;
  }
  return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
}

function matchesFilter(row: any, [column, value, op = "eq"]: Filter): boolean {
  const actual = resolvePath(row, column);
  switch (op) {
    case "in":
      return Array.isArray(value) && value.some((v) => sameValue(actual, v));
    case "gte": {
      const cmp = compareValues(actual, value);
      return Number.isNaN(cmp) ? true : cmp >= 0;
    }
    case "lt": {
      const cmp = compareValues(actual, value);
      return Number.isNaN(cmp) ? true : cmp < 0;
    }
    default:
      return sameValue(actual, value);
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return false;
}

export class SupabaseMock {
  tables: Record<string, any[]> = {};
  calls: RecordedCall[] = [];
  /**
   * When true, `confirm_trial_booking` applies the intended RPC contract to the
   * in-memory rows (status guard, capacity, duplicate seat, single transition)
   * instead of always answering "CONFIRMED". The real SQL still carries the
   * D-B05 downgrade defect — this mirror implements the *target* behaviour the
   * payment routes rely on (payment_mockup D7, L2).
   */
  simulateConfirmRpc = false;
  private queue: Record<string, ProgrammedResponse[]> = {};
  private rpcQueue: ProgrammedResponse[] = [];

  constructor(seed: SeedTables = {}) {
    this.reset(seed);
  }

  reset(seed: SeedTables = {}): void {
    this.tables = {};
    for (const [table, rows] of Object.entries(seed)) {
      this.tables[table] = rows.map((row) => ({ ...row }));
    }
    this.calls = [];
    this.queue = {};
    this.rpcQueue = [];
  }

  program(table: string, response: ProgrammedResponse): void {
    if (!this.queue[table]) this.queue[table] = [];
    this.queue[table].push(response);
  }

  programRpc(response: ProgrammedResponse): void {
    this.rpcQueue.push(response);
  }

  callsFor(table: string, op?: string): RecordedCall[] {
    return this.calls.filter(
      (c) => c.source === "from" && c.table === table && (!op || c.op === op)
    );
  }

  rpcCalls(): RecordedCall[] {
    return this.calls.filter((c) => c.source === "rpc");
  }

  rows(table: string): any[] {
    if (!this.tables[table]) this.tables[table] = [];
    return this.tables[table];
  }

  from = (table: string): unknown => this.build(table);

  rpc = async (name: string, params: unknown): Promise<ProgrammedResponse> => {
    this.calls.push({ source: "rpc", name, params });
    const programmed = this.rpcQueue.shift();
    if (programmed && !programmed.passThrough) return programmed;
    if (this.simulateConfirmRpc && name === "confirm_trial_booking") {
      return this.simulateConfirmTrialBooking(params as {
        p_booking_id: string;
        p_payment_result: string;
      });
    }
    return { data: "CONFIRMED", error: null };
  };

  /** Intended RPC semantics: guard + capacity + duplicate + one transition. */
  private simulateConfirmTrialBooking(p: {
    p_booking_id: string;
    p_payment_result: string;
  }): ProgrammedResponse {
    const booking = this.rows("bookings").find((b) => b.id === p.p_booking_id);
    if (!booking) {
      return { data: null, error: { message: `booking ${p.p_booking_id} not found` } };
    }
    // I5: a confirmed seat is never demoted by a late/again failure
    if (booking.status === "CONFIRMED") {
      return { data: "DUPLICATE_BOOKING", error: null };
    }
    if (booking.status !== "PENDING_PAYMENT") {
      return { data: "PAYMENT_FAILED", error: null };
    }
    if (p.p_payment_result !== "SUCCESS") {
      booking.status = "PAYMENT_FAILED";
      return { data: "PAYMENT_FAILED", error: null };
    }
    const trialClass = this.rows("trial_classes").find(
      (c) => c.id === booking.trial_class_id
    );
    if (trialClass && typeof trialClass.max_seats === "number") {
      const confirmed = this.rows("bookings").filter(
        (b) => b.trial_class_id === trialClass.id && b.status === "CONFIRMED"
      ).length;
      if (confirmed >= trialClass.max_seats) {
        booking.status = "PAYMENT_FAILED";
        return { data: "NO_SEATS_AVAILABLE", error: null };
      }
      const duplicate = this.rows("bookings").some(
        (b) =>
          b !== booking &&
          b.trial_class_id === booking.trial_class_id &&
          b.student_id === booking.student_id &&
          b.status === "CONFIRMED"
      );
      if (duplicate) {
        booking.status = "PAYMENT_FAILED";
        return { data: "DUPLICATE_BOOKING", error: null };
      }
    }
    booking.status = "CONFIRMED";
    return { data: "CONFIRMED", error: null };
  }

  private takeProgrammed(table: string): ProgrammedResponse | null {
    const queue = this.queue[table];
    if (!queue || queue.length === 0) return null;
    const next = queue.shift() as ProgrammedResponse;
    if (next.passThrough) return null;
    return next;
  }

  private build(table: string) {
    const self = this;
    const state = {
      op: "select" as "select" | "insert" | "update",
      filters: [] as Filter[],
      columns: undefined as unknown,
      payload: null as any,
      single: false,
      count: false,
      order: null as { column: string; ascending: boolean } | null,
    };

    const builder: any = {
      select(_columns?: unknown, options?: { count?: string; head?: boolean }) {
        state.columns = _columns;
        if (options && options.count === "exact") state.count = true;
        return builder;
      },
      eq(column: string, value: unknown) {
        state.filters.push([column, value]);
        return builder;
      },
      gte(column: string, value: unknown) {
        state.filters.push([column, value, "gte"]);
        return builder;
      },
      lt(column: string, value: unknown) {
        state.filters.push([column, value, "lt"]);
        return builder;
      },
      in(column: string, values: unknown[]) {
        state.filters.push([column, values, "in"]);
        return builder;
      },
      order(column: string, options?: { ascending?: boolean }) {
        state.order = {
          column,
          ascending: options?.ascending !== false,
        };
        return builder;
      },
      single() {
        state.single = true;
        return builder;
      },
      insert(payload: unknown) {
        state.op = "insert";
        state.payload = payload;
        return builder;
      },
      update(payload: unknown) {
        state.op = "update";
        state.payload = payload;
        return builder;
      },
      then(
        onFulfilled: (value: any) => any,
        onRejected?: (reason: any) => any
      ) {
        return Promise.resolve(self.execute(table, state)).then(
          onFulfilled,
          onRejected
        );
      },
    };

    return builder;
  }

  private execute(table: string, state: any) {
    this.calls.push({
      source: "from",
      table,
      op: state.op,
      filters: [...state.filters],
      columns: state.columns,
      payload: state.payload,
    });

    const programmed = this.takeProgrammed(table);
    if (programmed) return programmed;

    const rows = this.rows(table);

    if (state.op === "insert") {
      const payload = state.payload;
      const isArray = Array.isArray(payload);
      const candidates = isArray ? payload : [payload];
      for (const candidate of candidates) {
        if (candidate && typeof candidate === "object" && candidate.id != null) {
          const clash = rows.some((row) => row.id === candidate.id);
          if (clash) {
            return {
              data: null,
              error: {
                code: "23505",
                message:
                  "duplicate key value violates unique constraint",
                details: `Key (id)=(${candidate.id}) already exists.`,
              },
            };
          }
        }
      }
      for (const candidate of candidates) rows.push({ ...candidate });
      return { data: isArray ? candidates : candidates[0], error: null, count: candidates.length };
    }

    if (state.op === "update") {
      let count = 0;
      for (const row of rows) {
        if (state.filters.every((f: Filter) => matchesFilter(row, f))) {
          Object.assign(row, state.payload);
          count += 1;
        }
      }
      return { data: null, error: null, count };
    }

    let matched = rows.filter((row) =>
      state.filters.every((f: Filter) => matchesFilter(row, f))
    );
    if (state.order) {
      const { column, ascending } = state.order;
      matched = [...matched].sort((a, b) => {
        const left = a[column];
        const right = b[column];
        if (left === right) return 0;
        const result = left > right ? 1 : -1;
        return ascending ? result : -result;
      });
    }

    if (state.count) {
      return { data: null, error: null, count: matched.length };
    }

    // PostgREST embed: `select(…, payment_attempts (id, txn_id, status))`
    // returns the child rows with the parent. Rows that already carry an
    // inline `payment_attempts` array (test fixtures) are left untouched.
    const embedAttempts =
      typeof state.columns === "string" &&
      state.columns.includes("payment_attempts");
    const shape = (row: any) => {
      if (!embedAttempts || row.payment_attempts !== undefined) return { ...row };
      return {
        ...row,
        payment_attempts: this.rows("payment_attempts")
          .filter((attempt) => attempt.booking_id === row.id)
          .map((attempt) => ({ ...attempt })),
      };
    };

    if (state.single) {
      if (matched.length >= 1) {
        return { data: shape(matched[0]), error: null, count: matched.length };
      }
      return {
        data: null,
        error: {
          code: "PGRST116",
          message: "JSON object requested, multiple (or no) rows returned",
        },
        count: 0,
      };
    }
    return {
      data: matched.map((row) => shape(row)),
      error: null,
      count: matched.length,
    };
  }
}

/**
 * Wire the mocked `@/lib/supabase` module to a controller.
 * Call inside `beforeEach` (after `jest.clearAllMocks()`).
 */
export function installSupabaseMock(
  target: { from: jest.Mock; rpc: jest.Mock },
  seed: SeedTables = {},
  options: { simulateConfirmRpc?: boolean } = {}
): SupabaseMock {
  const ctl = new SupabaseMock(seed);
  ctl.simulateConfirmRpc = options.simulateConfirmRpc ?? false;
  target.from.mockImplementation((table: string) => ctl.from(table));
  target.rpc.mockImplementation((name: string, params: unknown) =>
    ctl.rpc(name, params)
  );
  return ctl;
}
