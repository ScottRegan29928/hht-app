import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { useSiteFlags } from "@/lib/siteContext";
import {
  ResortSwitch,
  useAssociationSite,
} from "@/components/owner/ResortSwitch";
import { Mail, FileText, Users } from "lucide-react";
import { BoardNominationDialog } from "@/components/owner/BoardNominationDialog";
import { resortTheme } from "@/components/owner/portalTheme";

/**
 * Board of directors and the association's governing documents.
 *
 * Board emails and unit/week holdings are owner-only information: this page is
 * behind the same server-side gate as the rest of the portal, unlike the old
 * WordPress page which hid its tables with CSS alone.
 */

export function OwnerBoardPage() {
  const { siteSlug, portalSlug, setSiteSlug, resorts, multi } =
    useAssociationSite();
  const { siteName: portalName } = useSiteFlags();
  // The heading has to follow the switcher, not the portal: an owner viewing
  // Swallowtail's documents from the Spicebush portal should see Swallowtail.
  const siteName =
    resorts.find(
      (r: { siteSlug: string; name: string }) => r.siteSlug === siteSlug,
    )?.name ?? portalName;
  const data = useQuery(api.ownerPortal.overview, { siteSlug, portalSlug });
  const [nominating, setNominating] = useState(false);
  const theme = resortTheme(siteSlug);

  // Deadlines come off the two resort volunteer forms [pdf, 2026].
  const deadline =
    siteSlug === "swallowtail" ? "September 1, 2026" : "August 20, 2026";

  if (data === undefined) {
    return (
      <div className="py-20 text-center text-muted-foreground animate-pulse">
        Loading board information…
      </div>
    );
  }

  const board = data.board ?? [];
  const formDocs = (data.documents?.form ?? []).filter((d: any) =>
    /volunteer|nomination/i.test(d.title),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Board &amp; Association</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your elected board and how to stand for a seat at {siteName}.
        </p>
        {multi && (
          <div className="pt-1">
            <ResortSwitch
              resorts={resorts}
              value={siteSlug}
              onChange={setSiteSlug}
            />
          </div>
        )}
      </div>

      <section className="border rounded-xl overflow-hidden">
        <h2 className="flex items-center gap-2 font-semibold px-5 py-4 border-b bg-muted/30">
          <Users className="w-4 h-4 text-muted-foreground" />
          Board of Directors
        </h2>
        {board.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">
            The board roster has not been published yet.
          </p>
        ) : (
          <ul className="divide-y">
            {board.map((m: any) => (
              <li
                key={m._id}
                className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4"
              >
                <div className="sm:w-56 sm:shrink-0">
                  <div className="font-medium">{m.name}</div>
                  {m.title && (
                    <div className="text-sm text-primary">{m.title}</div>
                  )}
                </div>
                {/* Wide enough for the longest real value, "Term 2024–2027 ·
                    Second term", on one line — it wrapped at w-48. */}
                <div className="text-sm text-muted-foreground sm:w-72 sm:whitespace-nowrap sm:shrink-0">
                  {m.termStart && m.termEnd
                    ? `Term ${m.termStart}–${m.termEnd}`
                    : null}
                  {m.termNote ? ` · ${m.termNote}` : ""}
                </div>
                <div className="text-sm text-muted-foreground flex-1">
                  {m.holdings}
                </div>
                {m.email && (
                  <a
                    href={`mailto:${m.email}`}
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Email
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border rounded-xl p-5">
        <h2 className="font-semibold mb-1">Serving on the board</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Owners are elected by owners. Complete the volunteer form to stand for
          a seat — forms must be received by {deadline}.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setNominating(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-medium"
            style={{ background: theme.accent }}
          >
            <FileText className="w-4 h-4" />
            Volunteer for the Board
          </button>
          {/* The printable PDF stays available: some owners will still want to
              mail or fax it, which is how the form has always worked. */}
          {formDocs.map((d: any) => (
            <a
              key={d._id}
              href={d.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:underline"
            >
              Download the printable form instead
            </a>
          ))}
        </div>
      </section>

      <BoardNominationDialog
        open={nominating}
        onClose={() => setNominating(false)}
        siteSlug={siteSlug}
        resortName={siteName}
        deadline={deadline}
      />
    </div>
  );
}
