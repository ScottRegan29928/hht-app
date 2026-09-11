import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSiteFlags } from "@/lib/siteContext";
import {
  FileText,
  Phone,
  Mail,
  CloudLightning,
  KeyRound,
  Tag,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Everything about being here: check-in and late arrival, the resort calendar,
 * renting beyond your own week, the HOA weeks-for-sale terms, and storm links.
 *
 * All of it is data from ownerPortalSettings + ownerDocuments, so The Club
 * Group edits these without a deploy.
 */

export function OwnerResortInfoPage() {
  const { siteSlug, siteName } = useSiteFlags();
  const data = useQuery(api.ownerPortal.overview, { siteSlug });

  if (data === undefined) {
    return (
      <div className="py-20 text-center text-muted-foreground animate-pulse">
        Loading resort information…
      </div>
    );
  }

  const s = data.settings;
  const stayDocs = data.documents?.stay ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Resort Information</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Arrival details, rentals and storm information for {siteName}.
        </p>
      </div>

      {stayDocs.length > 0 && (
        <Card icon={KeyRound} title="Arriving and staying">
          <ul className="grid sm:grid-cols-2 gap-2">
            {stayDocs.map((d: any) => (
              <li key={d._id}>
                <a
                  href={d.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg border hover:bg-muted/40 transition-colors text-sm font-medium"
                >
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  {d.title}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(s?.rentIntro || s?.rentContactName) && (
        <Card icon={Phone} title="Renting an additional week">
          {s?.rentIntro && <p className="text-sm leading-relaxed">{s.rentIntro}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {s?.rentContactName && (
              <span className="font-medium">{s.rentContactName}</span>
            )}
            {(s?.rentContactPhones ?? []).map((p: string) => (
              <a
                key={p}
                href={`tel:${p.replace(/[^\d+]/g, "")}`}
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <Phone className="w-3.5 h-3.5" />
                {p}
              </a>
            ))}
          </div>
        </Card>
      )}

      {s?.hoaSalesIntro && (
        <Card icon={Tag} title="Association weeks for sale">
          <p className="text-sm leading-relaxed">{s.hoaSalesIntro}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {s.hoaSalesContactName && (
              <span className="font-medium">{s.hoaSalesContactName}</span>
            )}
            {s.hoaSalesContactPhone && (
              <a
                href={`tel:${s.hoaSalesContactPhone.replace(/[^\d+]/g, "")}`}
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <Phone className="w-3.5 h-3.5" />
                {s.hoaSalesContactPhone}
              </a>
            )}
            {s.hoaSalesContactEmail && (
              <a
                href={`mailto:${s.hoaSalesContactEmail}`}
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <Mail className="w-3.5 h-3.5" />
                {s.hoaSalesContactEmail}
              </a>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Looking for a week from another owner instead? Those are in the{" "}
            <Link to="/owner/marketplace" className="text-primary hover:underline">
              owner marketplace
            </Link>
            , where the discount and fee waiver above do not apply.
          </p>
        </Card>
      )}

      {(s?.weatherLinks?.length ?? 0) > 0 && (
        <Card icon={CloudLightning} title="Hurricane and weather">
          {s?.weatherIntro && (
            <p className="text-sm leading-relaxed mb-3">{s.weatherIntro}</p>
          )}
          <ul className="space-y-1.5">
            {s!.weatherLinks!.map((l: any) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  {l.label}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border rounded-xl p-5">
      <h2 className="flex items-center gap-2 font-semibold mb-3">
        <Icon className="w-4 h-4 text-muted-foreground" />
        {title}
      </h2>
      {children}
    </section>
  );
}
