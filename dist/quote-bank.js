// Shared by the page, offline worker, and publishing checks.
export function validateQuoteBank(bank, labels) {
  if (!Array.isArray(bank) || !bank.length) throw new Error('quotes.json must contain a nonempty array.');
  const ids = new Set();
  for (const [index, quote] of bank.entries()) {
    const name = `Quote ${index + 1}`;
    if (!quote || typeof quote !== 'object' || Array.isArray(quote)) throw new Error(`${name} must be an object.`);
    for (const field of ['id', 'text', 'book', 'author']) {
      if (typeof quote[field] !== 'string' || !quote[field].trim()) throw new Error(`${name} needs a nonempty ${field}.`);
    }
    if (ids.has(quote.id)) throw new Error(`Duplicate quote id: ${quote.id}`);
    ids.add(quote.id);
    if (!Array.isArray(quote.tags) || !quote.tags.length || quote.tags.some(tag => typeof tag !== 'string' || !Object.hasOwn(labels, tag))) {
      throw new Error(`${name} (${quote.id}) needs tags from quote-tags.json.`);
    }
    if (quote.weight !== undefined && (typeof quote.weight !== 'number' || !Number.isFinite(quote.weight) || quote.weight <= 0)) {
      throw new Error(`${name} weight must be a positive number, if supplied.`);
    }
  }
  return bank;
}

// Use a single-flight refresher so focus + visibility events cannot race and
// replace a newer bank with an older response. Failed refreshes preserve state.
export function createBankRefresher({load, validate, apply}) {
  let pending;
  return function refresh() {
    if (!pending) pending = Promise.resolve().then(load).then(validate).then(apply).finally(() => { pending = undefined; });
    return pending;
  };
}
