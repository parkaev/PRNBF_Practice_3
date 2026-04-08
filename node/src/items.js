export function createItemsRepo() {
  const map = new Map();

  return {
    list() {
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    },
    get(id) {
      return map.get(id) ?? null;
    },
    create(name, price) {
      const id = randomId();
      const item = { id, name, price };
      map.set(id, item);
      return item;
    }
  };
}

function randomId() {
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}
