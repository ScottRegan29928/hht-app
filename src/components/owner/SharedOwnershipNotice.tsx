export type OwnerOfRecordGroup = {
  ownerOfRecord: string;
  sourceResort: string;
  communitySlug?: string;
  unitNumber: string;
  weeks: number[];
  unresolvedWeeks: string[];
};

/** Optional fields allow the UI to render safely while query results load. */
export type SharedOwnershipNoticeProps = {
  isSharedAccount?: boolean;
  ownerOfRecordGroups?: OwnerOfRecordGroup[];
};

export const SHARED_OWNERSHIP_NOTICE =
  "If you would like to separate these units into individual accounts, please contact The Club Group. A secondary email will be required to separate the accounts.";

/** Display only the server-authorized groups; never infer ownership from email. */
export function SharedOwnershipNotice({
  isSharedAccount,
  ownerOfRecordGroups = [],
}: SharedOwnershipNoticeProps) {
  if (!isSharedAccount) return null;

  return (
    <section
      aria-label="Shared account ownership"
      className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 space-y-2 break-words"
    >
      <h2 className="font-semibold">Shared account ownership</h2>
      <ul className="space-y-1">
        {ownerOfRecordGroups.map((group, index) => (
          <li key={index}>
            <span className="font-medium">Owner of record: </span>
            {group.ownerOfRecord} · {group.sourceResort} · Unit {group.unitNumber}
            {" · Weeks: "}{group.weeks.length ? group.weeks.join(", ") : "Not specified"}
            {group.unresolvedWeeks.length > 0 && (
              <span>
                {" · Source records (week not specified): "}{group.unresolvedWeeks.join(", ")}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p>{SHARED_OWNERSHIP_NOTICE}</p>
    </section>
  );
}
