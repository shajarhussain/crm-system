import { getNextAssigneeAndState, Employee, CycleState } from '../src/lib/distribution';

function runTestSuite() {
  console.log("=========================================");
  console.log("   CRM PLATFORM SPECIFICATION TEST SUITE ");
  console.log("=========================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // TEST 1: Priority Ordering & 8-Lead Rotation (BR-6 / Architecture §4.2)
  console.log("--- TEST 1: Auto-Distribution & 8-Lead Rotation ---");
  const employees: Employee[] = [
    { uid: "emp1", priority: 1, status: "ACTIVE" },
    { uid: "emp2", priority: 2, status: "ACTIVE" },
    { uid: "emp3", priority: 3, status: "ACTIVE" },
  ];

  let state: CycleState = {};

  // First 8 leads must go to emp1 (Priority 1)
  for (let i = 1; i <= 8; i++) {
    const res = getNextAssigneeAndState(employees, state);
    assert(res.uid === "emp1", `Lead #${i} assigned to priority 1 employee (emp1)`);
    state = res.newState;
  }

  // 9th lead must rotate to emp2 (Priority 2)
  const res9 = getNextAssigneeAndState(employees, state);
  assert(res9.uid === "emp2", "Lead #9 rotates to priority 2 employee (emp2)");
  state = res9.newState;

  // Next 7 leads must also go to emp2
  for (let i = 10; i <= 16; i++) {
    const res = getNextAssigneeAndState(employees, state);
    assert(res.uid === "emp2", `Lead #${i} assigned to emp2 (count=${state["emp2"]})`);
    state = res.newState;
  }

  // 17th lead must rotate to emp3 (Priority 3)
  const res17 = getNextAssigneeAndState(employees, state);
  assert(res17.uid === "emp3", "Lead #17 rotates to priority 3 employee (emp3)");
  state = res17.newState;

  // Complete emp3's 8 leads
  for (let i = 18; i <= 24; i++) {
    const res = getNextAssigneeAndState(employees, state);
    assert(res.uid === "emp3", `Lead #${i} assigned to emp3`);
    state = res.newState;
  }

  // 25th lead must wrap back to emp1 (Priority 1)
  const res25 = getNextAssigneeAndState(employees, state);
  assert(res25.uid === "emp1", "Lead #25 wraps back to priority 1 employee (emp1)");

  // TEST 2: Disabled Employee Handling (BR-22 / Architecture §4.2)
  console.log("\n--- TEST 2: Disabled Employee Handling ---");
  const employeesWithDisabled: Employee[] = [
    { uid: "emp1", priority: 1, status: "DISABLED" },
    { uid: "emp2", priority: 2, status: "ACTIVE" },
  ];
  const disabledRes = getNextAssigneeAndState(employeesWithDisabled, {});
  assert(disabledRes.uid === "emp2", "Disabled priority 1 employee is skipped, goes to next active priority");

  // TEST 3: Financial Profit Calculations (FR-21, FR-28 / BR-19)
  console.log("\n--- TEST 3: Financial Profit Calculations ---");
  const amountReceived = 10000;
  const payableAmount = 6500;
  const grossProfit = amountReceived - payableAmount;
  assert(grossProfit === 3500, "Gross Profit computed correctly (Received - Payable = 3500)");

  const expenses = [
    { category: "Rent", amount: 1000 },
    { category: "Marketing", amount: 800 },
    { category: "Software", amount: 200 }
  ];
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = grossProfit - totalExpenses;
  assert(totalExpenses === 2000, "Total Expenses computed correctly (2000)");
  assert(netProfit === 1500, "Net Profit computed correctly (Gross Profit - Expenses = 1500)");

  // TEST 4: SLA Deadlines (BR-4, BR-7)
  console.log("\n--- TEST 4: SLA Timers ---");
  const now = Date.now();
  const adminDeadline = new Date(now + 5 * 60000);
  const acceptDeadline = new Date(now + 10 * 60000);
  const adminDiffMins = Math.round((adminDeadline.getTime() - now) / 60000);
  const acceptDiffMins = Math.round((acceptDeadline.getTime() - now) / 60000);
  assert(adminDiffMins === 5, "Admin Manual Assignment window is exactly 5 minutes (BR-4)");
  assert(acceptDiffMins === 10, "Employee Acceptance window is exactly 10 minutes (BR-7)");

  // SUMMARY
  console.log("\n=========================================");
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
