import assert from "assert";
import { analyzePythonFeatures, PYTHON_ITEM_MAP } from "../languages/pythonLexer";

function testEdgeCases() {
  console.log("Running PythonLexer tests...");

  // Test 1: Bitshift >> should NOT trigger comparison operator > or < (Issue #24, #26)
  const bitshiftCode = `
class Solution:
    def distributeCandies(self, candyType: List[int]) -> int:
        return min(len(candyType) >> 1, len(set(candyType)))
`;
  // Empty unlocks
  const v1 = analyzePythonFeatures(bitshiftCode, new Set());
  // The only violations should NOT include comparison operators (6700903103)
  const hasComparison = v1.some((v) => v.itemId === 6700903103);
  assert.strictEqual(hasComparison, false, "Bitshift >> falsely triggered comparison operator!");
  console.log("✓ Test 1 Passed: Bitshift does not trigger comparison operator");

  // Test 2: match / case statement (Issue #22)
  const matchCode = `
class Solution:
    def hammingDistance(self, x: int, y: int):
        match 1:
            case 1:
                return 1
        return 2
`;
  const v2 = analyzePythonFeatures(matchCode, new Set());
  const hasMatch = v2.some((v) => v.itemId === 6700903107 && v.token === "match");
  assert.strictEqual(hasMatch, true, "match statement was not detected!");
  // If match is unlocked, it should not be in violations
  const v2Unlocked = analyzePythonFeatures(matchCode, new Set([6700903107]));
  assert.strictEqual(v2Unlocked.length, 0, "unlocked match was falsely reported!");
  console.log("✓ Test 2 Passed: match statement properly detected and unlocked");

  // Test 3: Variable names like is_valid or count_for should NOT trigger 'is' or 'for'
  const identCode = `
class Solution:
    def check(self):
        is_valid = True
        count_for = 0
        point = 10
        format_str = "hello"
`;
  // Unlocks: only '=' (6700903102)
  const v3 = analyzePythonFeatures(identCode, new Set([6700903102]));
  assert.strictEqual(v3.length, 0, `Variable names falsely triggered keywords: ${JSON.stringify(v3)}`);
  console.log("✓ Test 3 Passed: Identifiers with substring keywords not falsely triggered");

  // Test 4: Comments and strings containing keywords/operators are ignored
  const commentStringCode = `
class Solution:
    def test(self):
        # if x > 10 and y < 5:
        s = "for item in list: if a == b: return"
        """
        Multiline docstring with while, elif, else, +, -, *
        """
        return s
`;
  const v4 = analyzePythonFeatures(commentStringCode, new Set([6700903102])); // '=' unlocked
  assert.strictEqual(v4.length, 0, `Comment or string falsely triggered features: ${JSON.stringify(v4)}`);
  console.log("✓ Test 4 Passed: Comments and strings completely ignored");

  // Test 5: Boilerplate default parameters should not count as '='
  const defaultArgCode = `
class Solution:
    def solve(self, val: int = 0) -> int:
        return val
`;
  const v5 = analyzePythonFeatures(defaultArgCode, new Set());
  assert.strictEqual(v5.length, 0, `Boilerplate signature default arg '=' was falsely reported: ${JSON.stringify(v5)}`);
  console.log("✓ Test 5 Passed: Boilerplate signature default arg '=' ignored");

  // Test 6: Accurate line and column reporting
  const lineColCode = `
class Solution:
    def f(self):
        if x > 1:
            return True
`;
  const v6 = analyzePythonFeatures(lineColCode, new Set());
  const ifV = v6.find((v) => v.token === "if");
  assert(ifV);
  assert.strictEqual(ifV.line, 3);
  assert.strictEqual(ifV.startCol, 8);
  assert.strictEqual(ifV.endCol, 10);
  console.log("✓ Test 6 Passed: Accurate line and column positioning");

  console.log("All PythonLexer tests passed successfully!");
}

testEdgeCases();
