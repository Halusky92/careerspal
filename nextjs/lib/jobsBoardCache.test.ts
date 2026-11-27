import assert from "node:assert/strict";
import test from "node:test";
import { peekBoardCache, rememberBoardCache } from "./jobsBoardCache";
import type { Job } from "../types";

const job = (id: string): Job => ({ id, title: id, company: "Northwind" } as Job);

test("a shorter filtered page does not restore a longer page from another filter", () => {
  rememberBoardCache({ access: "guest", key: "all", jobs: [job("a"), job("b"), job("c")], total: 3 });
  rememberBoardCache({ access: "guest", key: "chief", jobs: [job("a")], total: 1 });
  assert.equal(peekBoardCache("guest", "chief")?.jobs.length, 1);
  assert.equal(peekBoardCache("guest", "all"), null);
});

test("the same filter keeps the longer loaded page", () => {
  rememberBoardCache({ access: "paid", key: "remote", jobs: Array.from({ length: 50 }, (_, index) => job(`p-${index}`)), total: 80 });
  rememberBoardCache({ access: "paid", key: "remote", jobs: [job("only")], total: 1 });
  assert.equal(peekBoardCache("paid", "remote")?.jobs.length, 50);
  assert.equal(peekBoardCache("guest", "remote"), null);
});
