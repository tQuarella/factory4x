// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/** Math functions whose results are implementation-approximated in JS, so they can differ across engines. */
const NON_DETERMINISTIC_MATH = [
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh',
  'asinh', 'acosh', 'atanh', 'exp', 'expm1', 'log', 'log1p', 'log2', 'log10',
  'pow', 'sqrt', 'cbrt', 'hypot', 'random',
];

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    // The simulation must be deterministic across JS engines (server, desktop browser, phone browser).
    // See docs/HANDOFF_PLAN.md "Cross-engine determinism". This rule set is a protected gate.
    files: ['packages/sim/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...NON_DETERMINISTIC_MATH.map((property) => ({
          object: 'Math',
          property,
          message: 'Non-deterministic across engines. Use integer/fixed-point math or the lookup tables in packages/sim.',
        })),
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Wall-clock time is banned in the sim; use the tick counter.' },
        { name: 'performance', message: 'Wall-clock time is banned in the sim; use the tick counter.' },
        { name: 'window', message: 'The sim has no browser dependencies.' },
        { name: 'document', message: 'The sim has no browser dependencies.' },
        { name: 'process', message: 'The sim has no Node dependencies.' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "BinaryExpression[operator='**']", message: 'Exponentiation is implementation-approximated; use integer multiplication.' },
        { selector: "AssignmentExpression[operator='**=']", message: 'Exponentiation is implementation-approximated; use integer multiplication.' },
      ],
    },
  },
);
