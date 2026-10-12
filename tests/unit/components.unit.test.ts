import { readdirSync, readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup as render } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Banner from "../../src/ui/components/Banner";
import Card from "../../src/ui/components/Card";
import DataTable, { type Column } from "../../src/ui/components/DataTable";
import EmptyState from "../../src/ui/components/EmptyState";
import MetricCard from "../../src/ui/components/MetricCard";

interface Row {
  name: string;
  amount: number;
}
const rows: Row[] = [
  { name: "Beta", amount: 20 },
  { name: "Acme", amount: 300 },
  { name: "Cyan", amount: 1 },
];
const columns: Column<Row>[] = [
  { key: "name", header: "Customer", cell: (r) => r.name, sortValue: (r) => r.name },
  {
    key: "amount",
    header: "Amount",
    cell: (r) => String(r.amount),
    sortValue: (r) => r.amount,
    numeric: true,
  },
  { key: "note", header: "Note", cell: () => "-" },
];
const table = (props: object = {}) =>
  render(h(DataTable<Row>, { caption: "Open AR", columns, rows, rowKey: (r) => r.name, ...props }));
const order = (html: string) =>
  [...html.matchAll(/<td[^>]*>(Beta|Acme|Cyan)<\/td>/g)].map((m) => m[1]);

describe("DataTable", () => {
  it("scrolls inside its own focusable, labelled region", () => {
    const html = table();
    expect(html).toContain('class="table-scroll"');
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Open AR"');
    expect(html).toContain('tabindex="0"');
  });

  it("makes sortable headers buttons and leaves other headers as plain text", () => {
    const html = table();
    expect(html.match(/<th[^>]*><button type="button"/g)).toHaveLength(2);
    expect(html).toContain(">Note</th>");
    expect(html).not.toContain("aria-sort"); // unsorted by default
  });

  it("renders rows in the given order by default", () => {
    expect(order(table())).toEqual(["Beta", "Acme", "Cyan"]);
  });

  it("renders ascending and descending states with aria-sort", () => {
    const asc = table({ initialSort: { key: "amount", dir: "asc" } });
    expect(asc).toContain('aria-sort="ascending"');
    expect(order(table({ initialSort: { key: "name", dir: "asc" } }))).toEqual([
      "Acme",
      "Beta",
      "Cyan",
    ]);
    const desc = table({ initialSort: { key: "name", dir: "desc" } });
    expect(desc).toContain('aria-sort="descending"');
    expect(order(desc)).toEqual(["Cyan", "Beta", "Acme"]);
  });

  it("right-aligns numeric columns", () => {
    expect(table()).toContain('class="num"');
  });

  it("shows the empty state, with custom text when given", () => {
    expect(table({ rows: [] })).toContain("Nothing to show.");
    expect(table({ rows: [], empty: "No invoices." })).toContain("No invoices.");
  });
});

describe("MetricCard", () => {
  const base = { label: "Total open AR", value: "$1,235" };

  it("default: label, value, context, and an explain button that names the metric", () => {
    const html = render(h(MetricCard, { ...base, context: "60 invoices", onExplain: () => {} }));
    expect(html).toContain("Total open AR");
    expect(html).toContain("$1,235");
    expect(html).toContain("60 invoices");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Explain<span");
  });

  it("explain-open: the button reports expanded", () => {
    expect(render(h(MetricCard, { ...base, onExplain: () => {}, explainOpen: true }))).toContain(
      'aria-expanded="true"',
    );
  });

  it("loading: a skeleton, no value and no explain button", () => {
    const html = render(h(MetricCard, { ...base, loading: true, onExplain: () => {} }));
    expect(html).toContain("skeleton");
    expect(html).not.toContain("$1,235");
    expect(html).not.toContain("<button");
  });

  it("error: an alert with the message, no value and no explain button", () => {
    const html = render(
      h(MetricCard, { ...base, error: "Could not compute", onExplain: () => {} }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Could not compute");
    expect(html).not.toContain("$1,235");
    expect(html).not.toContain("<button");
  });
});

describe("Banner, Card, EmptyState", () => {
  it("banners state their kind in text and use alert only for errors", () => {
    expect(render(h(Banner, { kind: "error", children: "Nope" }))).toMatch(/role="alert".*Error\./);
    expect(render(h(Banner, { kind: "warning", children: "Careful" }))).toMatch(
      /role="status".*Warning\./,
    );
    expect(render(h(Banner, { kind: "info", children: "FYI" }))).toMatch(/role="status".*Info\./);
  });

  it("banner shows an action button when given", () => {
    expect(
      render(
        h(Banner, { kind: "info", action: { label: "Undo", onClick: () => {} }, children: "x" }),
      ),
    ).toContain("Undo");
  });

  it("card shows its title only when given", () => {
    expect(render(h(Card, { title: "Aging", children: "body" }))).toContain("<h2");
    expect(render(h(Card, { children: "body" }))).not.toContain("<h2");
  });

  it("empty state offers its action", () => {
    const html = render(
      h(EmptyState, {
        title: "No data",
        message: "Load some",
        action: { label: "Load sample data", onClick: () => {} },
      }),
    );
    expect(html).toContain("No data");
    expect(html).toContain("Load sample data");
  });
});

describe("design tokens only", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
    );
  const root = new URL("../../src/ui", import.meta.url).pathname;

  it("has no hard-coded colours in components or app.css (tokens.css defines them)", () => {
    const offenders = files(root)
      .filter((f) => /\.(tsx?|css)$/.test(f) && !f.endsWith("tokens.css"))
      .filter((f) => /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
