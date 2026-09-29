/**
 * L7 (file-level) — seed.sql contract for the registration/login revision.
 * Test cases: LR-RG-001, LR-RG-002, LR-RG-013, LR-RG-019 (+ doc-truth guards).
 * These pin artifacts/seed.sql so the schema/seed cannot silently drift.
 */
import fs from "fs";
import path from "path";

const seed = fs.readFileSync(
  path.join(process.cwd(), "artifacts", "seed.sql"),
  "utf8"
);

const rowsStartingWith = (prefix: string): string[] =>
  seed
    .split("\n")
    .filter((line) => line.trimStart().startsWith(`('${prefix}`))
    .map((line) => line.trim());

const emailOf = (row: string): string => {
  const match = row.match(/'([^']+@[^']+)'/);
  return match ? match[1] : "";
};

const registrationRows = rowsStartingWith("REG-");
const loginRows = rowsStartingWith("LOG-");
const parentRows = rowsStartingWith("PAR-");
const studentRows = rowsStartingWith("STU-");
const knownEmails = new Set(
  [...parentRows, ...studentRows].map(emailOf).filter(Boolean)
);

describe("seed.sql — registration & login tables (LR-RG)", () => {
  test("LR-RG-001: DDL for both tables is present", () => {
    expect(seed).toMatch(/CREATE TABLE registrations \(/);
    expect(seed).toMatch(/CREATE TABLE login_attempts \(/);
    expect(seed).toMatch(/ALTER TABLE parents ADD CONSTRAINT uq_parents_id_email UNIQUE \(id, email\)/);
    expect(seed).toMatch(/ALTER TABLE students ADD CONSTRAINT uq_students_id_email UNIQUE \(id, email\)/);
  });

  test("LR-RG-001: composite email-match FKs and CHECKs are declared", () => {
    expect(seed).toMatch(/fk_reg_parent_email FOREIGN KEY \(parent_id, email\)/);
    expect(seed).toMatch(/fk_reg_student_email FOREIGN KEY \(student_id, email\)/);
    expect(seed).toMatch(/fk_login_parent_email FOREIGN KEY \(parent_id, email\)/);
    expect(seed).toMatch(/fk_login_student_email FOREIGN KEY \(student_id, email\)/);
    expect(seed).toMatch(/CONSTRAINT chk_reg_target CHECK/);
    expect(seed).toMatch(/CONSTRAINT chk_login_target CHECK/);
  });

  test("LR-RG-002: exactly 7 registration rows and 6 login attempt rows", () => {
    expect(registrationRows).toHaveLength(7);
    expect(loginRows).toHaveLength(6);
  });

  test("LR-RG-002: parents/students seed counts unchanged (3 / 4)", () => {
    expect(parentRows).toHaveLength(3);
    expect(studentRows).toHaveLength(4);
  });

  test("LR-RG-013: exactly one PENDING registration (carol@example.com)", () => {
    const pending = registrationRows.filter((row) => row.includes("'PENDING'"));
    expect(pending).toHaveLength(1);
    expect(pending[0]).toContain("carol@example.com");
    expect(pending[0]).toContain("REG-003");
  });

  test("LR-RG-014: login outcome distribution is 3 SUCCESS / 2 FAILED / 1 UNVERIFIED", () => {
    const count = (outcome: string) =>
      loginRows.filter((row) => row.includes(`'${outcome}'`)).length;
    expect(count("SUCCESS")).toBe(3);
    expect(count("FAILED")).toBe(2);
    expect(count("UNVERIFIED")).toBe(1);
    for (const row of loginRows) {
      if (!row.includes("'SUCCESS'")) {
        expect(row).toMatch(/'(Invalid login credentials|Email not confirmed)'/);
      }
    }
  });

  test("LR-RG-019: every registration/login email already exists in parents or students", () => {
    const newEmails = [...registrationRows, ...loginRows].map(emailOf);
    expect(newEmails).toHaveLength(13);
    for (const email of newEmails) {
      expect(knownEmails).toContain(email);
    }
  });

  test("LR-RG-017: both new tables are dropped before parents/students (idempotent rerun)", () => {
    const dropLogin = seed.indexOf("DROP TABLE IF EXISTS login_attempts");
    const dropRegs = seed.indexOf("DROP TABLE IF EXISTS registrations");
    const dropParents = seed.indexOf("DROP TABLE IF EXISTS parents");
    const dropStudents = seed.indexOf("DROP TABLE IF EXISTS students");
    expect(dropLogin).toBeGreaterThan(-1);
    expect(dropRegs).toBeGreaterThan(-1);
    expect(dropParents).toBeGreaterThan(-1);
    expect(dropStudents).toBeGreaterThan(-1);
    expect(dropLogin).toBeLessThan(dropParents);
    expect(dropRegs).toBeLessThan(dropParents);
    expect(dropLogin).toBeLessThan(dropStudents);
    expect(dropRegs).toBeLessThan(dropStudents);
  });

  test("LR-RG-018: parents seed rows never populate password_hash (credentials live in Supabase Auth)", () => {
    for (const row of parentRows) {
      expect(row).not.toContain("password_hash");
    }
    expect(seed).toMatch(/password_hash TEXT/);
  });

  test("verification queries V1-V4 are documented in seed.sql", () => {
    expect(seed).toMatch(/V1|registrations whose parent email does not match/i);
    expect(seed).toMatch(/login attempt orphans/i);
    expect(seed).toMatch(/registrations = 7/);
  });

  // F0 doc/contract truth — see fix_plan_sept_26.md §6 (enum vs DB CHECK drift).
  // BookingStatus omits REFUNDED and adds two RPC-only codes; must be fixed in F1.
  test.todo(
    "F1: BookingStatus enum must equal the bookings.status CHECK list from seed.sql (missing REFUNDED, extra DUPLICATE_BOOKING/NO_SEATS_AVAILABLE)"
  );
});
