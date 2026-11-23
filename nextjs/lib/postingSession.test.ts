import assert from "node:assert/strict";
import test from "node:test";
import { claimGuestPosting } from "./postingSession";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

test("a guest draft follows the account that signs in", () => {
  const store = memoryStore();
  store.setItem(
    "cp_draft_post::guest",
    JSON.stringify({ step: 3, formData: { title: "Ops lead", company: "North", description: "Run the board", applyUrl: "" } }),
  );
  store.setItem("cp_selected_plan::guest", JSON.stringify({ type: "Standard", price: 79 }));
  claimGuestPosting("u:user-1", store);
  const draft = JSON.parse(store.getItem("cp_draft_post::u:user-1") || "{}") as { step: number; formData: { title: string } };
  assert.equal(draft.step, 3);
  assert.equal(draft.formData.title, "Ops lead");
  assert.equal(store.getItem("cp_selected_plan::u:user-1"), JSON.stringify({ type: "Standard", price: 79 }));
  assert.equal(store.getItem("cp_draft_post::guest"), null);
});

test("an empty guest draft does not wipe a draft already on the account", () => {
  const store = memoryStore();
  store.setItem("cp_draft_post::guest", JSON.stringify({ step: 1, formData: { title: "", company: "", description: "", applyUrl: "" } }));
  store.setItem("cp_draft_post::u:user-1", JSON.stringify({ step: 2, formData: { title: "Kept", company: "Acme", description: "Stay", applyUrl: "" } }));
  claimGuestPosting("u:user-1", store);
  const draft = JSON.parse(store.getItem("cp_draft_post::u:user-1") || "{}") as { formData: { title: string } };
  assert.equal(draft.formData.title, "Kept");
});
