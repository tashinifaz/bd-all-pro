// Per-request store (AsyncLocalStorage) so page() can read the signed-in user's prefs without changing its signature.
module.exports = new (require('async_hooks').AsyncLocalStorage)();
