import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSiteFlags } from "@/lib/siteContext";
import { Mail, FileText, Users } from "lucide-react";

/**
 * Board of directors and the association's governing documents.
 *
 * Board emails and unit/week holdings are owner-only information: this page is
 * behind the same server-side gate as the rest of the portal, unlike the old
 * WordPress page which hid its tables with CSS alone.
 */

export function OwnerBoardPage() {
  const { siteSlug, siteName } = useSiteFlags();
  const data = useQuery(api.ownerPortal.overview, { siteSlug });

  if (data === undefined) {
    return (
      <div className="py-20 text-center text-muted-foreground animate-pulse">
        Loading board information…
      </div>
    );
  }

  const board = data.board ?? [];
  const assocDocs = data.documents?.association ?? [];
  const formDocs = (data.documents?.form ?? []).filter((d: any) =>
    /volunteer|nomination/i.test(d.title)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Board &amp; Association</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your elected board and the governing documents for {siteName}.
        </p>
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
                <div className="sm:w-64">
                  <div className="font-medium">{m.name}</div>
                  {m.title && (
                    <div className="text-sm text-primary">{m.title}</div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground sm:w-48">
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

      {formDocs.length > 0 && (
        <section className="border rounded-xl p-5">
          <h2 className="font-semibold mb-1">Serving on the board</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Owners are elected by owners. Complete the nomination form to stand
            for a seat.
          </p>
          <div className="flex flex-wrap gap-2">
            {formDocs.map((d: any) => (
              <a
                key={d._id}
                href={d.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium hover:bg-muted/40 transition-colors"
              >
                <FileText className="w-4 h-4 text-muted-foreground" />
                {d.title}
              </a>
            ))}
          </div>
        </section>
      )}

      {assocDocs.length > 0 && (
        <section className="border rounded-xl overflow-hidden">
          <h2 className="font-semibold px-5 py-4 border-b bg-muted/30">
            Association documents
          </h2>
          <ul className="divide-y">
            {assocDocs.map((d: any) => (
              <li key={d._id}>
                <a
                  href={d.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors text-sm font-medium"
                >
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  {d.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
