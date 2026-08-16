"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNextAssigneeAndState = getNextAssigneeAndState;
/**
 * Pure function to resolve the next assignee and return the updated cycle state.
 * Implements the 8-lead rotation and priority-based assignment rules.
 */
function getNextAssigneeAndState(employees, cycleState) {
    // 1. Filter and sort employees by priority (1 = highest)
    const activeEmployees = employees
        .filter(e => e.status === 'ACTIVE')
        .sort((a, b) => a.priority - b.priority);
    if (activeEmployees.length === 0) {
        return { uid: null, newState: cycleState };
    }
    let selectedUid = null;
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
    const newState = Object.assign(Object.assign({}, cycleState), { [selectedUid]: (cycleState[selectedUid] || 0) + 1 });
    return { uid: selectedUid, newState };
}
//# sourceMappingURL=distribution.js.map