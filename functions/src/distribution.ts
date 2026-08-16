export interface Employee {
  uid: string;
  priority: number;
  status: 'ACTIVE' | 'DISABLED';
}

export interface CycleState {
  [uid: string]: number; // count of leads assigned in current cycle
}

/**
 * Pure function to resolve the next assignee and return the updated cycle state.
 * Implements the 8-lead rotation and priority-based assignment rules.
 */
export function getNextAssigneeAndState(
  employees: Employee[], 
  cycleState: CycleState
): { uid: string | null; newState: CycleState } {
  // 1. Filter and sort employees by priority (1 = highest)
  const activeEmployees = employees
    .filter(e => e.status === 'ACTIVE')
    .sort((a, b) => a.priority - b.priority);

  if (activeEmployees.length === 0) {
    return { uid: null, newState: cycleState };
  }

  let selectedUid: string | null = null;
  let needsReset = true;

  // 2. Find the first employee who hasn't reached 8 leads
  for (const emp of activeEmployees) {
    const count = cycleState[emp.uid] || 0;
    if (count < 8) {
      selectedUid = emp.uid;
      needsReset = false;
      break;
    }
  }

  // 3. If everyone has reached 8 leads, start a new cycle
  if (needsReset) {
    selectedUid = activeEmployees[0].uid;
    const newState = { [selectedUid]: 1 };
    return { uid: selectedUid, newState };
  } 
  
  // 4. Otherwise, increment their count in the current cycle
  const newState = { 
    ...cycleState, 
    [selectedUid as string]: (cycleState[selectedUid as string] || 0) + 1 
  };
  return { uid: selectedUid as string, newState };
}
