import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { usePageSpace } from "../../src/client/use-page-space";

it("renders on the server before a browser viewport or mount exists", () => {
  function Probe() {
    return createElement("span", null, usePageSpace(null, true) ? "pushed" : "overlay");
  }
  expect(renderToString(createElement(Probe))).toBe("<span>overlay</span>");
});
