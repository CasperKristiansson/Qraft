import { describe, expect, it } from "vitest";
import { isAllowedWebOrigin, parseOrigin } from "../../src/server/origin";

describe("trusted local request origins", () => {
  it("allows loopback CLI requests and matching browser origins", () => {
    for (const host of ["localhost:5173", "127.0.0.1:5173", "[::1]:5173", "app.localhost:5173"]) {
      const url = `http://${host}/__qraft/document`;
      expect(isAllowedWebOrigin(new Request(url))).toBe(true);
      expect(isAllowedWebOrigin(new Request(url, { headers: { origin: `http://${host}` } }))).toBe(
        true,
      );
    }
  });

  it("rejects rebinding hosts even with a matching or absent Origin", () => {
    for (const host of ["attacker.example", "192.168.1.2", "localhost.attacker.example"]) {
      expect(isAllowedWebOrigin(new Request(`http://${host}/__qraft/files`))).toBe(false);
      expect(
        isAllowedWebOrigin(
          new Request(`http://${host}/__qraft/files`, { headers: { origin: `http://${host}` } }),
        ),
      ).toBe(false);
    }
    expect(
      isAllowedWebOrigin(
        new Request("http://localhost:5173/__qraft/files", {
          headers: { host: "attacker.example" },
        }),
      ),
    ).toBe(false);
    expect(
      isAllowedWebOrigin(
        new Request("http://localhost:5173/__qraft/files", {
          headers: { "sec-fetch-site": "cross-site" },
        }),
      ),
    ).toBe(false);
  });

  it("allows an explicitly configured local gateway without trusting forwarded headers", () => {
    const url = "http://localhost:3000/api/qraft/files";
    const configured = "https://review.local.test:3060";
    expect(
      isAllowedWebOrigin(new Request(url, { headers: { origin: configured } }), configured),
    ).toBe(true);
    expect(
      isAllowedWebOrigin(
        new Request(url, {
          headers: { origin: configured, "x-forwarded-host": "attacker.example" },
        }),
      ),
    ).toBe(false);
    for (const invalid of [
      "https://user:secret@localhost",
      "https://localhost/path",
      "file:///tmp",
      "https://localhost?token=secret",
    ])
      expect(parseOrigin(invalid)).toBeNull();
  });
});
