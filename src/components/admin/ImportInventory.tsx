"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import {
  previewInventoryImport,
  commitInventoryImport,
  type ImportPreviewResponse,
  type ImportCommitResponse,
} from "@/app/admin/actions";

type Phase = "choose" | "preview" | "done";

export function ImportInventory() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("choose");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [result, setResult] = useState<ImportCommitResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setPhase("choose");
    setFile(null);
    setPreview(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function close() {
    setOpen(false);
    reset();
  }

  function onPreview(f: File) {
    setFile(f);
    const fd = new FormData();
    fd.set("file", f);
    startTransition(async () => {
      const res = await previewInventoryImport(fd);
      setPreview(res);
      setPhase("preview");
    });
  }

  function onCommit() {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await commitInventoryImport(fd);
      setResult(res);
      setPhase("done");
      if (res.ok) router.refresh();
    });
  }

  const plan = preview?.plan;
  const canCommit =
    !!plan && plan.blocking.length === 0 && plan.rowCount > 0;

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary px-3 py-2 text-xs">
        Import from Excel
      </button>

      <Modal open={open} onClose={close} title="Import Inventory from Excel">
        {/* Step 1: choose file */}
        {phase === "choose" && (
          <div>
            <p className="mb-3 text-sm text-muted">
              Upload an <strong>.xlsx</strong> or <strong>.csv</strong> where each row is a
              product/vendor pricing line. Products, vendors, and pricing are created or
              updated automatically and appear in the catalog for ordering.
            </p>
            <a
              href="/api/admin/import/template"
              className="btn-ghost mb-4 inline-block"
            >
              ↓ Download template (.xlsx)
            </a>
            <label className="field-label">Spreadsheet file</label>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPreview(f);
              }}
              className="field-input"
            />
            {pending && <p className="mt-3 text-sm text-muted">Reading file…</p>}
          </div>
        )}

        {/* Step 2: preview */}
        {phase === "preview" && preview && (
          <div>
            {preview.fatal ? (
              <p className="border-2 border-accent bg-accent-soft px-3 py-2 text-sm font-semibold text-accent">
                {preview.fatal}
              </p>
            ) : plan ? (
              <div>
                <div className="mb-4 grid grid-cols-3 gap-px border-2 border-ink bg-ink text-center">
                  <Stat label="Rows" value={plan.rowCount} />
                  <Stat label="Products" value={plan.products.length} />
                  <Stat label="Pricing lines" value={plan.pricingCount} />
                </div>

                <div className="mb-4 max-h-56 overflow-y-auto border-2 border-ink">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Preferred</th>
                        <th className="text-right">Vendors</th>
                        <th className="text-right">State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.products.map((p) => (
                        <tr key={p.name}>
                          <td className="font-semibold">{p.name}</td>
                          <td>{p.category}</td>
                          <td>{p.preferredVendor ?? "—"}</td>
                          <td className="text-right">{p.vendorCount}</td>
                          <td className="text-right">
                            <span
                              className={
                                p.status === "new"
                                  ? "badge badge-received"
                                  : "badge badge-pending"
                              }
                            >
                              {p.status === "new" ? "New" : "Update"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="mb-3 text-xs text-muted">
                  Vendors:{" "}
                  {plan.vendors.map((v, i) => (
                    <span key={v.name}>
                      {i > 0 && ", "}
                      {v.name}
                      <span className={v.status === "new" ? "text-accent" : ""}>
                        {v.status === "new" ? " (new)" : ""}
                      </span>
                    </span>
                  ))}
                </p>

                {plan.blocking.length > 0 && (
                  <div className="mb-3 border-2 border-accent bg-accent-soft px-3 py-2 text-sm text-accent">
                    <p className="font-bold uppercase tracking-wide">Fix before importing</p>
                    <ul className="mt-1 list-inside list-disc">
                      {plan.blocking.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {preview.parseErrors && preview.parseErrors.length > 0 && (
                  <div className="mb-3 border-2 border-muted bg-paper px-3 py-2 text-xs text-muted">
                    <p className="font-bold uppercase tracking-wide">
                      {preview.parseErrors.length} row(s) will be skipped
                    </p>
                    <ul className="mt-1 list-inside list-disc">
                      {preview.parseErrors.slice(0, 6).map((e) => (
                        <li key={e.rowNumber}>
                          Row {e.rowNumber}: {e.message}
                        </li>
                      ))}
                      {preview.parseErrors.length > 6 && <li>…and more</li>}
                    </ul>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={reset} className="btn-secondary px-4 py-2">
                    Choose another file
                  </button>
                  <button
                    onClick={onCommit}
                    disabled={!canCommit || pending}
                    className="btn-primary px-4 py-2"
                  >
                    {pending
                      ? "Importing…"
                      : `Import ${plan.products.length} product(s)`}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">Nothing to preview.</p>
            )}
          </div>
        )}

        {/* Step 3: done */}
        {phase === "done" && result && (
          <div>
            {result.ok && result.summary ? (
              <div>
                <p className="mb-3 border-2 border-accent bg-accent-soft px-3 py-2 text-sm font-semibold text-accent">
                  Import complete.
                </p>
                <ul className="mb-4 space-y-1 text-sm">
                  <li>Products created: <strong>{result.summary.productsCreated}</strong></li>
                  <li>Products updated: <strong>{result.summary.productsUpdated}</strong></li>
                  <li>Vendors created: <strong>{result.summary.vendorsCreated}</strong></li>
                  <li>Vendors updated: <strong>{result.summary.vendorsUpdated}</strong></li>
                  <li>Pricing lines saved: <strong>{result.summary.pricingUpserted}</strong></li>
                  {result.summary.rowsSkipped > 0 && (
                    <li className="text-muted">Rows skipped: {result.summary.rowsSkipped}</li>
                  )}
                </ul>
                <div className="flex gap-3">
                  <button onClick={reset} className="btn-secondary px-4 py-2">
                    Import another
                  </button>
                  <button onClick={close} className="btn-primary px-4 py-2">
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-3 border-2 border-accent bg-accent-soft px-3 py-2 text-sm font-semibold text-accent">
                  {result.error ?? "Import failed."}
                </p>
                <button onClick={reset} className="btn-secondary px-4 py-2">
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="text-xl font-extrabold">{value}</p>
    </div>
  );
}
