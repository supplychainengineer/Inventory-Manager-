"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logProcedure } from "@/app/(portal)/actions";

export interface ProcedureDTO {
  id: string;
  name: string;
  materials: { label: string }[];
}

export function LogWorkTable({ procedures }: { procedures: ProcedureDTO[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  function log(id: string) {
    const count = Math.max(1, counts[id] || 1);
    const fd = new FormData();
    fd.set("procedureId", id);
    fd.set("count", String(count));
    setBusyId(id);
    startTransition(async () => {
      await logProcedure(fd);
      setCounts((c) => ({ ...c, [id]: 1 }));
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Procedure</th>
            <th>Consumes (per procedure)</th>
            <th className="text-right">How many?</th>
          </tr>
        </thead>
        <tbody>
          {procedures.map((p) => (
            <tr key={p.id}>
              <td className="font-semibold">{p.name}</td>
              <td>
                <div className="flex flex-wrap gap-1">
                  {p.materials.length ? (
                    p.materials.map((m, i) => (
                      <span key={i} className="border border-muted/40 px-2 py-0.5 text-[11px]">
                        {m.label}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted">no materials</span>
                  )}
                </div>
              </td>
              <td>
                <div className="flex items-center justify-end gap-2">
                  <input
                    type="number"
                    min={1}
                    value={counts[p.id] ?? 1}
                    onChange={(e) =>
                      setCounts((c) => ({ ...c, [p.id]: Math.max(1, Number(e.target.value) || 1) }))
                    }
                    className="w-16 border-2 border-ink px-2 py-1 text-sm outline-none focus:border-accent"
                    aria-label={`How many ${p.name}`}
                  />
                  <button
                    onClick={() => log(p.id)}
                    disabled={pending}
                    className="btn-primary px-3 py-1 text-xs"
                  >
                    {busyId === p.id ? "Logging…" : "Log"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {procedures.length === 0 && (
            <tr>
              <td colSpan={3} className="py-6 text-center text-sm text-muted">
                No procedures defined yet. An admin can add them under Procedures.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
