import test from 'node:test';
import assert from 'node:assert/strict';
import { getNextAssigneeAndState, LEADS_PER_TURN, type Employee, type CycleState } from './distribution.ts';

const roster = (): Employee[] => [
  { uid: 'emp1', priority: 1, status: 'ACTIVE' },
  { uid: 'emp2', priority: 2, status: 'ACTIVE' },
  { uid: 'emp3', priority: 3, status: 'ACTIVE' },
];

/** Assigns `count` leads in sequence and returns who received each one. */
function drain(employees: Employee[], count: number, exclude: string[] = []) {
  let state: CycleState = {};
  const order: (string | null)[] = [];
  for (let i = 0; i < count; i++) {
    const result = getNextAssigneeAndState(employees, state, exclude);
    order.push(result.uid);
    state = result.newState;
  }
  return { order, state };
}

test('the highest priority employee takes the first eight leads', () => {
  const { order } = drain(roster(), LEADS_PER_TURN);
  assert.deepEqual(order, Array(LEADS_PER_TURN).fill('emp1'));
});

test('the ninth lead rotates to the next priority', () => {
  const { order } = drain(roster(), LEADS_PER_TURN + 1);
  assert.equal(order[LEADS_PER_TURN], 'emp2');
});

test('a full cycle is eight each in priority order, then wraps to the top', () => {
  const total = LEADS_PER_TURN * 3;
  const { order } = drain(roster(), total + 1);

  assert.deepEqual(order.slice(0, 8), Array(8).fill('emp1'));
  assert.deepEqual(order.slice(8, 16), Array(8).fill('emp2'));
  assert.deepEqual(order.slice(16, 24), Array(8).fill('emp3'));
  assert.equal(order[24], 'emp1', 'lead 25 starts a new cycle at priority 1');
});

test('the wrap-around clears every counter, not just the selected one', () => {
  const { state } = drain(roster(), LEADS_PER_TURN * 3 + 1);
  assert.equal(state.emp1, 1);
  assert.equal(state.emp2, 0);
  assert.equal(state.emp3, 0);
});

test('priority order wins over roster order', () => {
  const shuffled: Employee[] = [
    { uid: 'low', priority: 5, status: 'ACTIVE' },
    { uid: 'high', priority: 1, status: 'ACTIVE' },
  ];
  const { uid } = getNextAssigneeAndState(shuffled, {});
  assert.equal(uid, 'high');
});

test('employees on the same priority resolve deterministically', () => {
  const tied: Employee[] = [
    { uid: 'zara', priority: 2, status: 'ACTIVE' },
    { uid: 'ahmed', priority: 2, status: 'ACTIVE' },
  ];
  assert.equal(getNextAssigneeAndState(tied, {}).uid, 'ahmed');
  assert.equal(getNextAssigneeAndState([...tied].reverse(), {}).uid, 'ahmed');
});

test('disabled employees are skipped without breaking the sequence', () => {
  const withDisabled: Employee[] = [
    { uid: 'emp1', priority: 1, status: 'DISABLED' },
    { uid: 'emp2', priority: 2, status: 'ACTIVE' },
    { uid: 'emp3', priority: 3, status: 'ACTIVE' },
  ];
  const { order } = drain(withDisabled, LEADS_PER_TURN + 1);
  assert.deepEqual(order.slice(0, 8), Array(8).fill('emp2'));
  assert.equal(order[8], 'emp3');
});

test('no active employees yields no assignee and leaves state untouched', () => {
  const allDisabled: Employee[] = [{ uid: 'emp1', priority: 1, status: 'DISABLED' }];
  const state: CycleState = { emp1: 3 };
  const result = getNextAssigneeAndState(allDisabled, state);
  assert.equal(result.uid, null);
  assert.deepEqual(result.newState, state);
});

test('an empty roster yields no assignee', () => {
  assert.equal(getNextAssigneeAndState([], {}).uid, null);
});

// --- reassignment (BR-8, architecture.md §4.3) --------------------------------

test('an excluded employee is skipped on a reassignment pass', () => {
  const result = getNextAssigneeAndState(roster(), {}, ['emp1']);
  assert.equal(result.uid, 'emp2');
});

test('excluding an employee preserves their place in the rotation', () => {
  // emp1 is mid-turn with three leads when a reassignment excludes them.
  const state: CycleState = { emp1: 3 };
  const result = getNextAssigneeAndState(roster(), state, ['emp1']);

  assert.equal(result.uid, 'emp2');
  assert.equal(result.newState.emp1, 3, 'emp1 keeps their count and does not lose their turn');
});

test('a lead nobody can take returns null rather than cycling forever', () => {
  const attempted = ['emp1', 'emp2', 'emp3'];
  const result = getNextAssigneeAndState(roster(), {}, attempted);
  assert.equal(result.uid, null, 'the caller parks the lead for manual assignment');
});

test('wrap-around triggered during a reassignment still resets the whole roster', () => {
  // Everyone eligible is full; emp1 is excluded but also at the cap.
  const state: CycleState = { emp1: 8, emp2: 8, emp3: 8 };
  const result = getNextAssigneeAndState(roster(), state, ['emp1']);

  assert.equal(result.uid, 'emp2', 'the first eligible employee starts the new cycle');
  assert.equal(result.cycleReset, true);
  assert.equal(result.newState.emp1, 0, 'the excluded employee is reset too, not left stranded at 8');
  assert.equal(result.newState.emp2, 1);
  assert.equal(result.newState.emp3, 0);
});

test('the input cycle state is never mutated', () => {
  const state: CycleState = { emp1: 2 };
  const snapshot = { ...state };
  getNextAssigneeAndState(roster(), state);
  assert.deepEqual(state, snapshot);
});

test('distribution across a long run stays even', () => {
  const { order } = drain(roster(), LEADS_PER_TURN * 3 * 4);
  const counts = order.reduce<Record<string, number>>((acc, uid) => {
    if (uid) acc[uid] = (acc[uid] ?? 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(counts, { emp1: 32, emp2: 32, emp3: 32 });
});
