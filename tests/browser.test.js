// Browser engine tests: address-bar parsing, tab titles and the back/forward stack.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveInput, displayTitle, createHistory, internalPage, HOME_URL, SEARCH_URL } from '../js/apps/browser-engine.js';

test('resolveInput keeps full URLs', () => {
  assert.equal(resolveInput('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(resolveInput('  http://x.org  '), 'http://x.org');
});

test('resolveInput never returns script or data URLs', () => {
  assert.equal(resolveInput('javascript://%0aalert(1)').startsWith(SEARCH_URL), true);
  assert.equal(resolveInput('data://text/html,hi').startsWith(SEARCH_URL), true);
  assert.equal(resolveInput('javascript:alert(1)').startsWith(SEARCH_URL), true);
});

test('resolveInput adds https to bare domains and http to local hosts', () => {
  assert.equal(resolveInput('wikipedia.org'), 'https://wikipedia.org');
  assert.equal(resolveInput('en.wikipedia.org/wiki/Cat'), 'https://en.wikipedia.org/wiki/Cat');
  assert.equal(resolveInput('localhost:8080'), 'http://localhost:8080');
  assert.equal(resolveInput('127.0.0.1'), 'http://127.0.0.1');
});

test('resolveInput searches plain words', () => {
  assert.equal(resolveInput('cute cats'), SEARCH_URL + 'cute%20cats');
  assert.equal(resolveInput('hello'), SEARCH_URL + 'hello');
});

test('resolveInput maps internal pages and empty input', () => {
  assert.equal(resolveInput(''), HOME_URL);
  assert.equal(resolveInput('about:history'), 'fakeos://history');
  assert.equal(resolveInput('fakeos://bookmarks'), 'fakeos://bookmarks');
  assert.equal(internalPage('fakeos://history?x'), 'history');
});

test('displayTitle names internal pages, searches and hosts', () => {
  assert.equal(displayTitle(HOME_URL), 'New Tab');
  assert.equal(displayTitle('fakeos://nope'), 'Page Not Found');
  assert.equal(displayTitle('https://www.example.com/x'), 'example.com');
  assert.equal(displayTitle(SEARCH_URL + 'cats'), 'cats - Search');
});

test('history moves back and forward and drops forward entries on visit', () => {
  const h = createHistory();
  assert.equal(h.canBack, false);
  h.visit('a');
  h.visit('b');
  assert.equal(h.back(), 'a');
  assert.equal(h.canForward, true);
  assert.equal(h.forward(), 'b');
  h.back();
  h.visit('c');
  assert.equal(h.canForward, false);
  assert.equal(h.back(), 'a');
  assert.equal(h.back(), HOME_URL);
  assert.equal(h.back(), HOME_URL);
});

test('visiting the current page does not add an entry', () => {
  const h = createHistory('a');
  h.visit('a');
  assert.equal(h.canBack, false);
});
