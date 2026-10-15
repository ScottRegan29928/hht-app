/**
 * Rental payments — Stripe connection status, the HostAway payment schedule
 * mirrored for checkout, Stripe account routing per property, and recent
 * checkout attempts. Backend: convex/rentalCheckout.ts.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { CreditCard, Plus, Trash2, CheckCircle2, AlertTriangle, Info } from "lucide-react";

type Inst = { label: string; pct: number; daysBefore: number | null };
type Account = "heritage" | "seapines";
const ACCOUNT_LABEL: Record<Account, string> = {
  heritage: "Heritage Vacations",
  seapines: "Swallowtail & Spicebush",
};

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function AdminPaymentsPage() {
  const data = useQuery(api.rentalCheckout.adminOverview);
  const saveSchedule = useMutation(api.rentalCheckout.saveSchedule);
  const setOverride = useMutation(api.rentalCheckout.setAccountOverride);

  const [schedule, setSchedule] = useState<Inst[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [chargeMode, setChargeMode] = useState<"card_capture" | "card_on_file">("card_capture");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!data) return;
    setSchedule(data.settings.schedule);
    setConfirmed(data.settings.scheduleConfirmed);
    setChargeMode(data.settings.chargeMode);
  }, [data]);

  const total = useMemo(
    () => Math.round(schedule.reduce((a, s) => a + (Number(s.pct) || 0), 0) * 100) / 100,
    [schedule]
  );

  if (data === undefined) return <div className="p-8 text-muted-foreground">Loading payments…</div>;

  const counts = data.routing.reduce(
    (acc, r) => ({ ...acc, [r.account]: (acc[r.account as Account] ?? 0) + 1 }),
    {} as Record<Account, number>
  );
  const rows = data.routing.filter(
    (r) =>
      !filter ||
      r.address.toLowerCase().includes(filter.toLowerCase()) ||
      r.community.toLowerCase().includes(filter.toLowerCase())
  );

  const onSave = async () => {
    try {
      await saveSchedule({ schedule, scheduleConfirmed: confirmed, chargeMode });
      toast.success("Payment settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message.replace(/^.*Uncaught Error:\s*/, "").split("\n")[0] : "Save failed");
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-primary" /> Rental Payments
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Guests pay online before dates are held. Charges settle into The Club Group's Stripe
          accounts; HostAway charges the later installments.
        </p>
      </div>

      {/* Stripe accounts */}
      <section className="grid md:grid-cols-2 gap-4">
        {data.accounts.map((a) => (
          <div key={a.key} className="border rounded-xl p-5 bg-background">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{a.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {counts[a.key as Account] ?? 0} properties routed here
                </p>
              </div>
              {a.configured ? (
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    a.mode === "live" ? "bg-green-100 text-green-800" : "bg-violet-100 text-violet-800"
                  }`}
                >
                  {a.mode === "live" ? "Live" : "Test mode"}
                </span>
              ) : (
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                  Not connected
                </span>
              )}
            </div>
            {!a.configured && (
              <p className="text-xs text-muted-foreground mt-3">
                Waiting on API keys{!a.hasSecret ? " (secret" : ""}
                {!a.hasSecret && !a.hasPublishable ? " and" : !a.hasSecret ? ")" : " ("}
                {!a.hasPublishable ? " publishable)" : ""}. Until then, rentals on this account use
                the request form.
              </p>
            )}
          </div>
        ))}
      </section>

      <div className="flex items-start gap-2 text-xs text-muted-foreground border rounded-lg px-4 py-3 bg-muted/20">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          HostAway reservation creation is{" "}
          <strong>{data.hostawayWritesEnabled ? "ON" : "OFF until go-live"}</strong>. Test-mode
          bookings never write to HostAway; they hold dates on this site only.
        </span>
      </div>

      {/* Schedule */}
      <section className="border rounded-xl p-5 bg-background space-y-4">
        <div>
          <h2 className="font-semibold">Payment schedule</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Must match the schedule in HostAway. Installments already due when a guest books are
            collected at booking.
          </p>
        </div>
        <div className="space-y-2">
          {schedule.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                className="flex-1 min-w-48 px-3 py-2 border rounded-lg text-sm"
                value={s.label}
                onChange={(e) =>
                  setSchedule(schedule.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                }
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  className="w-20 px-3 py-2 border rounded-lg text-sm"
                  value={s.pct}
                  onChange={(e) =>
                    setSchedule(schedule.map((x, j) => (j === i ? { ...x, pct: Number(e.target.value) } : x)))
                  }
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              {s.daysBefore === null ? (
                <span className="text-sm text-muted-foreground w-52">at booking</span>
              ) : (
                <div className="flex items-center gap-1 w-52">
                  <input
                    type="number"
                    className="w-20 px-3 py-2 border rounded-lg text-sm"
                    value={s.daysBefore}
                    onChange={(e) =>
                      setSchedule(
                        schedule.map((x, j) => (j === i ? { ...x, daysBefore: Number(e.target.value) } : x))
                      )
                    }
                  />
                  <span className="text-sm text-muted-foreground">days before check-in</span>
                </div>
              )}
              {s.daysBefore !== null && (
                <button
                  className="p-2 text-muted-foreground hover:text-red-600"
                  onClick={() => setSchedule(schedule.filter((_, j) => j !== i))}
                  aria-label="Remove installment"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button
            className="text-sm text-primary inline-flex items-center gap-1"
            onClick={() =>
              setSchedule([...schedule, { label: "Due before check-in", pct: 0, daysBefore: 30 }])
            }
          >
            <Plus className="w-4 h-4" /> Add installment
          </button>
        </div>
        <p className={`text-sm font-medium ${total === 100 ? "text-green-700" : "text-red-700"}`}>
          Total: {total}% {total !== 100 && "— must equal 100%"}
        </p>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>
            Confirmed by The Club Group
            <span className="block text-xs text-muted-foreground">
              Live payments stay off until this is checked.
            </span>
          </span>
        </label>

        <div className="space-y-1 text-sm">
          <p className="font-medium">How the first payment is taken</p>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              className="mt-1"
              checked={chargeMode === "card_capture"}
              onChange={() => setChargeMode("card_capture")}
            />
            <span>
              Website charges the first installment; HostAway charges the rest
              <span className="block text-xs text-muted-foreground">Default.</span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              className="mt-1"
              checked={chargeMode === "card_on_file"}
              onChange={() => setChargeMode("card_on_file")}
            />
            <span>
              Website saves the card; HostAway charges every installment
              <span className="block text-xs text-muted-foreground">
                Use if the test booking shows HostAway charging the first installment again.
              </span>
            </span>
          </label>
        </div>

        <button
          onClick={onSave}
          disabled={total !== 100}
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          Save payment settings
        </button>
      </section>

      {/* Routing */}
      <section className="border rounded-xl bg-background">
        <div className="p-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">Which Stripe account each property uses</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Swallowtail and Spicebush default to their own account; everything else goes to
              Heritage Vacations.
            </p>
          </div>
          <input
            placeholder="Filter properties"
            className="px-3 py-2 border rounded-lg text-sm w-56"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="max-h-[420px] overflow-y-auto border-t">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground sticky top-0">
              <tr>
                <th className="px-5 py-2">Property</th>
                <th className="px-5 py-2">Community</th>
                <th className="px-5 py-2">Stripe account</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.propertyId} className="border-t">
                  <td className="px-5 py-2">{r.address}</td>
                  <td className="px-5 py-2 text-muted-foreground">{r.community}</td>
                  <td className="px-5 py-2">
                    <select
                      value={r.account}
                      onChange={(e) =>
                        setOverride({
                          propertyId: r.propertyId as Id<"properties">,
                          account: e.target.value as Account,
                        }).then(() => toast.success("Routing updated"))
                      }
                      className={`px-2 py-1 border rounded-md text-sm bg-background ${
                        r.overridden ? "border-amber-400" : ""
                      }`}
                    >
                      <option value="heritage">{ACCOUNT_LABEL.heritage}</option>
                      <option value="seapines">{ACCOUNT_LABEL.seapines}</option>
                    </select>
                    {r.overridden && <span className="ml-2 text-xs text-amber-700">override</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent checkouts */}
      <section className="border rounded-xl bg-background">
        <h2 className="font-semibold p-5 pb-3">Recent online checkouts</h2>
        {data.sessions.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">No checkouts yet.</p>
        ) : (
          <div className="overflow-x-auto border-t">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Started</th>
                  <th className="px-4 py-2">Guest</th>
                  <th className="px-4 py-2">Property / dates</th>
                  <th className="px-4 py-2">Paid now / total</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((s) => (
                  <tr key={s._id} className="border-t align-top">
                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-2">
                      {s.guest}
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </td>
                    <td className="px-4 py-2">
                      {s.propertyAddress}
                      <div className="text-xs text-muted-foreground">
                        {s.checkIn} → {s.checkOut}
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {money(s.dueNowCents)} / {money(s.totalCents)}
                      {s.stripeMode === "test" && <div className="text-xs text-violet-700">test</div>}
                    </td>
                    <td className="px-4 py-2">
                      <StatusPill status={s.status} />
                      {s.hostawayWrite === "held_prelaunch" && s.status === "confirmed" && (
                        <div className="text-xs text-muted-foreground mt-1">Not sent to HostAway (pre-launch)</div>
                      )}
                      {s.error && <div className="text-xs text-red-700 mt-1">{s.error}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    confirmed: ["Confirmed", "bg-green-100 text-green-800"],
    awaiting_payment: ["Abandoned / in progress", "bg-muted text-muted-foreground"],
    dates_lost: ["Dates lost — voided", "bg-amber-100 text-amber-800"],
    failed: ["Failed", "bg-red-100 text-red-800"],
  };
  const [label, cls] = map[status] ?? [status, "bg-muted"];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {status === "confirmed" ? <CheckCircle2 className="w-3 h-3" /> : status !== "awaiting_payment" ? <AlertTriangle className="w-3 h-3" /> : null}
      {label}
    </span>
  );
}
