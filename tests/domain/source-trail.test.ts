import { expect, it } from "vitest";
import { sourceTrail } from "../../src/client/picker/source-trail";
import { elementReferenceSchema } from "../../src/domain/commands";
import { normalizeElement } from "../../src/markdown/patch";

it("keeps a bounded useful source trail without stack arguments, dependencies or duplicate locations", () => {
  const context = {
    componentName: "Button",
    filePath: "file:///project/src/Button.tsx",
    lineNumber: 4,
    columnNumber: 2,
    stack: [
      {
        functionName: "Button",
        fileName: "/project/src/Button.tsx",
        lineNumber: 4,
        columnNumber: 2,
        args: ["private"],
      },
      { functionName: "internal", fileName: "/project/node_modules/react/index.js" },
      { functionName: "ignored", fileName: "/project/src/ignore.ts", isIgnoreListed: true },
      {
        functionName: "Checkout",
        fileName: "/project/src/Checkout.tsx?token=private#hash",
        lineNumber: 18,
      },
      ...Array.from({ length: 10 }, (_, index) => ({
        functionName: `Wrapper${index}`,
        fileName: `/project/src/Wrapper${index}.tsx`,
      })),
    ],
  };
  const trail = sourceTrail(context);
  expect(trail).toHaveLength(5);
  expect(trail[1]).toEqual({
    component: "Checkout",
    source: "/project/src/Checkout.tsx",
    line: 18,
    column: null,
  });
  expect(JSON.stringify(trail)).not.toMatch(/private|node_modules|ignored|args/u);
  const element = {
    route: "/cart",
    component: null,
    source: null,
    line: null,
    column: null,
    selector: null,
    context: { tag: "button", attributes: {}, text: "", ancestors: [], sourceTrail: trail },
  };
  expect(elementReferenceSchema.safeParse(element).success).toBe(true);
  expect(
    elementReferenceSchema.safeParse({
      ...element,
      context: { ...element.context, sourceTrail: [...trail, trail[0]] },
    }).success,
  ).toBe(false);
  expect(
    elementReferenceSchema.safeParse({
      ...element,
      context: { ...element.context, sourceTrail: [{ ...trail[0], args: ["private"] }] },
    }).success,
  ).toBe(false);
  expect(normalizeElement(element, "/project")?.context?.sourceTrail?.[0]?.source).toBe(
    "src/Button.tsx",
  );
});

it("omits outside-root and dependency source entries on the server", () => {
  const sourceTrail = [
    "../private.ts",
    "/elsewhere/private.ts",
    "https://example.com/code",
    "node_modules/lib.ts",
    "src/Checkout.tsx?secret=1",
  ].map((source) => ({ component: "Component", source, line: 2, column: null }));
  const element = {
    route: "/cart",
    component: null,
    source: null,
    line: null,
    column: null,
    selector: null,
    context: { tag: "button", attributes: {}, text: "", ancestors: [], sourceTrail },
  };
  expect(normalizeElement(element, "/project")?.context?.sourceTrail).toEqual([
    { component: "Component", source: "src/Checkout.tsx", line: 2, column: null },
  ]);
});
