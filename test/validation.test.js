import test from "node:test";
import assert from "node:assert/strict";

test("Node runtime provides native fetch", () => {
  assert.equal(typeof fetch, "function");
});

test("catalog URL builder uses numeric IDs", () => {
  const id = 123456789;
  assert.equal(`https://www.roblox.com/catalog/${id}`, "https://www.roblox.com/catalog/123456789");
});

test("item IDs reject invalid values", () => {
  const parseId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  };
  assert.equal(parseId("123"), 123);
  assert.equal(parseId("-1"), null);
  assert.equal(parseId("abc"), null);
  assert.equal(parseId("1.5"), null);
});
