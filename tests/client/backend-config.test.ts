import { expect, it } from "vitest";
import { QA } from "../../src/client/QA";

it("shared mode accepts only same-origin route paths before mounting the drawer", () => {
  for (const endpoint of [
    "//other-host",
    "/api//qa",
    "https://other.example/qa",
    "/api/qa?scope=other",
  ])
    expect(() => QA({ backend: { endpoint, sessionKey: "session-1" } })).toThrow(
      "same-origin endpoint",
    );
  expect(() => QA({ backend: { endpoint: "/api/qa", sessionKey: "session-1" } })).not.toThrow();
});
