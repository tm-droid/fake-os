// Calculator engine tests. Run with: node --test tests/calc.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCalculator } from '../js/apps/calc-engine.js';

// Each character is one key, so '12*3+1=' presses 1, 2, *, 3, +, 1, =.
function typed(calc, text) {
  for (const key of text) calc.press(key);
  return calc.display;
}

test('12 * 3 + 1 = gives 37', () => {
  assert.equal(typed(createCalculator(), '12*3+1='), '37');
});

test('division by zero shows Error and ignores input until AC', () => {
  const calc = createCalculator();
  assert.equal(typed(calc, '5/0='), 'Error');
  assert.equal(typed(calc, '7'), 'Error');
  calc.press('AC');
  assert.equal(calc.display, '0');
});

test('operators apply left to right: 2 + 3 * 4 = gives 20', () => {
  assert.equal(typed(createCalculator(), '2+3*4='), '20');
});

test('0.1 + 0.2 = shows 0.3', () => {
  assert.equal(typed(createCalculator(), '0.1+0.2='), '0.3');
});

test('percent divides the current entry by 100', () => {
  const calc = createCalculator();
  assert.equal(typed(calc, '50'), '50');
  calc.press('percent');
  assert.equal(calc.display, '0.5');
});

test('sign flips the current entry', () => {
  const calc = createCalculator();
  assert.equal(typed(calc, '5'), '5');
  calc.press('sign');
  assert.equal(calc.display, '-5');
  assert.equal(typed(calc, '3'), '-53');
  calc.press('sign');
  assert.equal(calc.display, '53');
});

test('sign right after an operator starts a negative operand', () => {
  const calc = createCalculator();
  typed(calc, '2+');
  calc.press('sign');
  assert.equal(typed(calc, '3='), '-1');
});

test('sign after equals negates the result', () => {
  const calc = createCalculator();
  typed(calc, '2+3=');
  calc.press('sign');
  assert.equal(calc.display, '-5');
});

test('backspace removes the last digit and shows 0 when empty', () => {
  const calc = createCalculator();
  assert.equal(typed(calc, '125'), '125');
  calc.press('backspace');
  assert.equal(calc.display, '12');
  calc.press('backspace');
  assert.equal(calc.display, '1');
  calc.press('backspace');
  assert.equal(calc.display, '0');
});

test('repeated equals repeats the last operation', () => {
  const calc = createCalculator();
  assert.equal(typed(calc, '2+3=='), '8');
  assert.equal(typed(calc, '='), '11');
});

test('equals after a multiply reuses the operand', () => {
  const calc = createCalculator();
  assert.equal(typed(calc, '2*3=='), '18');
});

test('pressing an operator twice replaces it', () => {
  assert.equal(typed(createCalculator(), '2+*3='), '6');
});

test('a leading zero is replaced by the next digit', () => {
  assert.equal(typed(createCalculator(), '05'), '5');
  assert.equal(typed(createCalculator(), '0.5'), '0.5');
});

test('display holds at most 12 digits', () => {
  assert.equal(typed(createCalculator(), '1234567890123456'), '123456789012');
});

test('large results switch to exponent notation', () => {
  assert.equal(typed(createCalculator(), '123456789*10000000='), '1.23456789e+15');
});

test('small results switch to exponent notation', () => {
  assert.equal(typed(createCalculator(), '1/8000000='), '1.25e-7');
});

test('repeating decimals show 12 digits', () => {
  assert.equal(typed(createCalculator(), '1/3='), '0.333333333333');
});

test('equals with no pending operation does nothing', () => {
  assert.equal(typed(createCalculator(), '7='), '7');
});
