const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

let now = 1800000000000;
const platform = { OS: 'android' };
const saved = new Map(), displayed = [], canceled = [];
const native = {
  createChannel: async () => {},
  displayNotification: async notification => { displayed.push(notification); },
  cancelNotification: async id => { canceled.push(id); },
};
function load() {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/notifications/ongoingUpgrades.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const requireMock = id => {
    if (id === 'react-native') return { Platform: platform };
    if (id === '@react-native-async-storage/async-storage') return { getItem: async key => saved.get(key) ?? null, setItem: async (key, value) => { saved.set(key, value); } };
    if (id === 'react-native-notify-kit') return { __esModule: true, default: native, AndroidCategory: { PROGRESS: 'progress' }, AndroidImportance: { LOW: 2 }, EventType: { DELIVERED: 3 } };
    if (id === '../utils/upgradeAvailability') {
      const helper = { exports: {} };
      const helperCode = ts.transpileModule(fs.readFileSync('src/utils/upgradeAvailability.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
      vm.runInNewContext('(function(module,exports){' + helperCode + '})', { Date: { now: () => now } })(helper, helper.exports);
      return helper.exports;
    }
    throw new Error('Unexpected import ' + id);
  };
  class Clock extends Date { static now() { return now; } }
  vm.runInNewContext('(function(require,module,exports){' + code + '})', { Date: Clock })(requireMock, module, module.exports);
  return module.exports;
}
const row = (id, completesAt, extra = {}) => ({ id, name: id, targetLevel: 12, completesAt, village: 'home', kind: 'buildings', ...extra });
const delivered = tag => ({ type: 3, detail: { notification: { data: { type: 'imported-upgrade', accountTag: tag } } } });

async function main() {
  let service = load();
  const first = now + 60000, second = now + 120000, third = now + 180000;
  const rows = [row('Lab', third), row('Queen', second), row('Cannon', first), row('Already done', now - 1), row('Confirmed', first, { confirmed: true }), row('Invalid', NaN)];
  await service.syncOngoingUpgradeNotification('#A', rows, 6, 'Chief');
  const initial = displayed.at(-1);
  assert.equal(initial.title, 'Next: Cannon · Lv 12');
  assert.match(initial.body, /2 more upgrading/);
  assert.match(initial.body, / · Chief$/);
  assert.doesNotMatch(initial.body, /#A/);
  assert.match(initial.body, /Home: 3\/6 builders free \(tracked\)/);
  assert.equal(initial.android.timestamp, first);
  assert.equal(initial.android.ongoing, true);
  assert.equal(initial.android.showChronometer, true);
  assert.equal(initial.android.chronometerDirection, 'down');
  assert.equal(initial.android.pressAction.id, 'default');
  const count = displayed.length;
  await service.handleOngoingUpgradeEvent(delivered('#B'));
  await service.handleOngoingUpgradeEvent({ type: 0, detail: delivered('#A').detail });
  await service.handleOngoingUpgradeEvent({ type: 3, detail: { notification: initial } });
  assert.equal(displayed.length, count, 'Other accounts, dismissals and the card itself cannot advance the queue');
  now = first + 1;
  service = load(); // Simulate a fresh headless JS runtime, retaining only disk state.
  await service.handleOngoingUpgradeEvent(delivered('#A'));
  assert.equal(displayed.at(-1).title, 'Next: Queen · Lv 12');
  assert.match(displayed.at(-1).body, / · Chief$/, 'Name survives headless queue advancement');
  assert.equal(displayed.at(-1).android.timestamp, second);
  assert.match(displayed.at(-1).body, /Home: 4\/6 builders free/);
  assert.match(displayed.at(-1).body, /1 more upgrading/);
  now = second + 1;
  await service.handleOngoingUpgradeEvent(delivered('#A'));
  assert.equal(displayed.at(-1).title, 'Next: Lab · Lv 12');
  assert.doesNotMatch(displayed.at(-1).body, /more upgrading/);
  now = third + 1;
  await service.handleOngoingUpgradeEvent(delivered('#A'));
  assert.equal(canceled.at(-1), initial.id, 'Clear the card after the last upgrade, without touching completion alerts');
  await Promise.all([
    service.syncOngoingUpgradeNotification('#A', [row('Old account', now + 60000)]),
    service.syncOngoingUpgradeNotification('#B', [row('New account', now + 90000)]),
  ]);
  await service.handleOngoingUpgradeEvent(delivered('#A'));
  assert.equal(displayed.at(-1).data.accountTag, '#B');
  await service.syncOngoingUpgradeNotification('', []);
  assert.equal(canceled.at(-1), initial.id);
  const before = displayed.length;
  await service.handleOngoingUpgradeEvent(delivered('#B'));
  assert.equal(displayed.length, before, 'Signing out must invalidate the saved queue');
  const future = now + 90000;
  await service.syncOngoingUpgradeNotification('#A', [row('Hero', future, { kind: 'heroes' }), row('Research', future, { kind: 'troops' }), row('Spell', future, { kind: 'spells' }), row('Pet', future, { kind: 'pets' }), row('BB defense', future, { village: 'builderBase' })], 6);
  assert.match(displayed.at(-1).body, /Home: 5\/6 builders free/, 'Research, pets and Builder Base do not occupy Home builders');
  await service.syncOngoingUpgradeNotification('#A', [row('Unknown', future, { kind: 'other' })], 6);
  assert.doesNotMatch(displayed.at(-1).body, /builders free/, 'Unknown upgrade kinds cannot imply a precise builder count');
  await service.syncOngoingUpgradeNotification('#A', [row('Building', future)], null);
  assert.doesNotMatch(displayed.at(-1).body, /builders free/);
  await service.syncOngoingUpgradeNotification('#A', [row('Building', future), row('Hero', future, { kind: 'heroes' }), row('Another building', future)], 2);
  assert.match(displayed.at(-1).body, /Home: 0\/2 builders free/, 'Never show negative free builders');
  const beforeIOS = displayed.length;
  platform.OS = 'ios';
  await service.syncOngoingUpgradeNotification('#A', rows);
  assert.equal(displayed.length, beforeIOS, 'Ongoing upgrade card is Android-only');
  console.log('Ongoing upgrade notification checks passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
