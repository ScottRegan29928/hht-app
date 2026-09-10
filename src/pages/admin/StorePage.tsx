import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { SitePicker } from "@/components/admin/ContentControls";
import { toast } from "sonner";
import { Plus, Trash2, Users, DollarSign, Check, Ban } from "lucide-react";

/**
 * Store — annual maintenance fees.
 *
 * Deliberately usable with no payment processor connected [scott, 2026-09-10]:
 * staff define fees, bill them to owners, and record payment by check, phone
 * or the management-company portal. A $0 fee is valid and settles itself.
 */
type Tab = "fees" | "charges";

function dollarsToCents(input: string): number {
  const n = Number(input.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function AdminStorePage() {
  const [siteSlug, setSiteSlug] = useState("");
  const [tab, setTab] = useState<Tab>("fees");

  const items = useQuery(api.store.adminListItems, {
    siteSlug: siteSlug || undefined,
  });
  const charges = useQuery(api.store.adminListCharges, {
    siteSlug: siteSlug || undefined,
  });
  const summary = useQuery(api.store.adminChargeSummary, {
    siteSlug: siteSlug || undefined,
  });

  const saveItem = useMutation(api.store.saveItem);
  const deleteItem = useMutation(api.store.deleteItem);
  const billItem = useMutation(api.store.billItemToOwners);
  const setChargeStatus = useMutation(api.store.setChargeStatus);

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    feeYear: String(new Date().getFullYear() + 1),
  });
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!siteSlug) {
      toast.error("Pick a site first — a fee belongs to one site");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Give the fee a name");
      return;
    }
    setBusy(true);
    try {
      await saveItem({
        siteSlug,
        name: form.name,
        description: form.description || undefined,
        priceCents: dollarsToCents(form.price),
        feeYear: form.feeYear ? Number(form.feeYear) : undefined,
        isActive: true,
      });
      toast.success("Fee created");
      setShowNew(false);
      setForm({ name: "", description: "", price: "", feeYear: form.feeYear });
    } catch (e: any) {
      toast.error(e?.message?.replace(/^.*Error:\s*/, "") ?? "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const handleBill = async (itemId: string, name: string) => {
    if (
      !window.confirm(
        `Bill "${name}" to every owner with a week at this resort?\n\nOwners who already have this fee are skipped, so it is safe to run again later.`
      )
    )
      return;
    try {
      const res = await billItem({ itemId: itemId as any });
      toast.success(
        `${res.created} charge${res.created === 1 ? "" : "s"} created` +
          (res.skipped ? `, ${res.skipped} already billed` : "")
      );
    } catch (e: any) {
      toast.error(e?.message?.replace(/^.*Error:\s*/, "") ?? "Could not bill");
    }
  };

  const money = (cents: number) =>
    cents === 0
      ? "Free"
      : `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Store</h1>
          <p className="text-muted-foreground">
            Annual maintenance fees, and who has paid them.
          </p>
        </div>
        {tab === "fees" && (
          <button
            onClick={() => setShowNew(!showNew)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New fee
          </button>
        )}
      </div>

      <div className="max-w-xs mb-6">
        <SitePicker
          value={siteSlug}
          onChange={setSiteSlug}
          includeAll
          label="Filter by site"
        />
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <div className="border rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Outstanding
            </p>
            <p className="text-2xl font-bold mt-1">{money(summary.dueCents)}</p>
            <p className="text-xs text-muted-foreground">
              {summary.dueCount} charge{summary.dueCount === 1 ? "" : "s"} due
            </p>
          </div>
          <div className="border rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Collected
            </p>
            <p className="text-2xl font-bold mt-1">{money(summary.paidCents)}</p>
            <p className="text-xs text-muted-foreground">
              {summary.paidCount} paid
            </p>
          </div>
          <div className="border rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Waived
            </p>
            <p className="text-2xl font-bold mt-1">{summary.waivedCount}</p>
            <p className="text-xs text-muted-foreground">not collectible</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b mb-6">
        {(["fees", "charges"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "fees" ? "Fees" : "Owner charges"}
          </button>
        ))}
      </div>

      {showNew && tab === "fees" && (
        <div className="border rounded-xl p-5 mb-6 bg-muted/20 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="2027 Annual Maintenance Fee"
                className="w-full px-3 py-2 border rounded-lg bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Amount
                </label>
                <input
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="1250.00"
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave blank or 0 for a free item.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Fee year
                </label>
                <input
                  value={form.feeYear}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      feeYear: e.target.value.replace(/[^0-9]/g, ""),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Covers insurance, landscaping and reserves."
              className="w-full px-3 py-2 border rounded-lg bg-background"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={busy}
            className="px-5 py-2 bg-primary text-primary-foreground rounded-lg font-semibold disabled:opacity-60"
          >
            {busy ? "Saving…" : "Create fee"}
          </button>
        </div>
      )}

      {tab === "fees" &&
        (items === undefined ? (
          <div className="animate-pulse text-muted-foreground py-12">Loading…</div>
        ) : items.length === 0 ? (
          <div className="border rounded-xl py-16 text-center bg-muted/30">
            <DollarSign className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium mb-1">No fees yet</p>
            <p className="text-sm text-muted-foreground">
              Create one, then bill it to the owners at that resort.
            </p>
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Fee</th>
                  <th className="px-4 py-3 font-medium">Site</th>
                  <th className="px-4 py-3 font-medium">Year</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Active</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((i: any) => (
                  <tr key={i._id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <span className="font-medium">{i.name}</span>
                      {i.description && (
                        <span className="block text-xs text-muted-foreground">
                          {i.description}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {i.siteSlug}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {i.feeYear ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-medium">{i.priceLabel}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {i.isActive ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleBill(i._id, i.name)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border hover:bg-muted transition-colors"
                          title="Create a charge for every owner at this resort"
                        >
                          <Users className="w-3.5 h-3.5" />
                          Bill owners
                        </button>
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Delete "${i.name}"?`)) return;
                            try {
                              await deleteItem({ itemId: i._id });
                              toast.success("Fee deleted");
                            } catch (e: any) {
                              toast.error(
                                e?.message?.replace(/^.*Error:\s*/, "") ??
                                  "Could not delete"
                              );
                            }
                          }}
                          className="p-1.5 text-red-600 rounded-md hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "charges" &&
        (charges === undefined ? (
          <div className="animate-pulse text-muted-foreground py-12">Loading…</div>
        ) : charges.length === 0 ? (
          <div className="border rounded-xl py-16 text-center bg-muted/30">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium mb-1">Nothing billed yet</p>
            <p className="text-sm text-muted-foreground">
              Use “Bill owners” on a fee to create charges.
            </p>
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Unit / week</th>
                  <th className="px-4 py-3 font-medium">Fee</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {charges.map((c: any) => (
                  <tr key={c._id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <span className="font-medium">{c.ownerName}</span>
                      {c.ownerEmail && (
                        <span className="block text-xs text-muted-foreground">
                          {c.ownerEmail}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.weekLabel ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.itemName}
                      {c.feeYear ? ` (${c.feeYear})` : ""}
                    </td>
                    <td className="px-4 py-3 font-medium">{c.amountLabel}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          c.status === "paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : c.status === "due"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {c.status}
                      </span>
                      {c.paymentMethod && c.status === "paid" && (
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          {c.paymentMethod}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {c.status !== "paid" && (
                          <button
                            onClick={async () => {
                              const ref =
                                window.prompt(
                                  "Record payment. Check number or reference (optional):"
                                ) ?? undefined;
                              await setChargeStatus({
                                chargeId: c._id,
                                status: "paid",
                                paymentMethod: "manual",
                                paymentRef: ref || undefined,
                              });
                              toast.success("Marked paid");
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border hover:bg-muted transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Mark paid
                          </button>
                        )}
                        {c.status === "due" && (
                          <button
                            onClick={async () => {
                              await setChargeStatus({
                                chargeId: c._id,
                                status: "waived",
                              });
                              toast.success("Waived");
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border hover:bg-muted transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Waive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
