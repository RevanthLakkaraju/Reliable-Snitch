import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import NavigationLink from "../app/components/navigation-link.ts";

test("portal navigation uses native same-tab anchors with no click interception", () => {
  const link = NavigationLink({ href: "/disruptions", children: "Register" });
  assert.equal(link.type, "a");
  assert.equal(link.props.href, "/disruptions");
  for (const prop of ["onClick", "onMouseEnter", "onTouchStart", "target"])
    assert.equal(link.props[prop], undefined);
});

test("links preserve query strings, skip links, accessible labels and design classes", () => {
  for (const href of ["/report", "/track?code=TE-1006", "#main", "#citizen-main"]) {
    const markup = renderToStaticMarkup(createElement(NavigationLink, {
      href, className: "button primary", "aria-label": "Open report",
    }, "Open"));
    assert.equal(markup, `<a href="${href}" class="button primary" aria-label="Open report">Open</a>`);
  }
});

test("explicit new-tab, download and caller-provided event behavior remains intact", () => {
  const onClick = () => {};
  const link = NavigationLink({
    href: "/api/images/example", target: "_blank", rel: "noreferrer",
    download: "evidence.jpg", onClick, children: "Photo",
  });
  assert.equal(link.props.target, "_blank");
  assert.equal(link.props.rel, "noreferrer");
  assert.equal(link.props.download, "evidence.jpg");
  assert.equal(link.props.onClick, onClick);
});

test("no portal screen reintroduces the failing hosted client-router Link", () => {
  const appDirectory = fileURLToPath(new URL("../app/", import.meta.url));
  for (const entry of readdirSync(appDirectory, { recursive: true })) {
    if (!/\.[jt]sx?$/.test(entry)) continue;
    const source = readFileSync(`${appDirectory}/${entry}`, "utf8");
    assert.doesNotMatch(source, /(?:from\s*|import\s*\()["']next\/link["']/, entry);
  }
});
