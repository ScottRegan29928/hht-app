import type { OwnershipGroup } from "../../../convex/ownerOwnership";

/** Keep every week visibly attached to its resort and unit, even for large rosters. */
export function OwnerOwnershipSummary({ groups }: { groups: OwnershipGroup[] }) {
  return (
    <section aria-label="Ownership details" className="mt-3 space-y-2 text-sm">
      {groups.length === 0 ? <p className="text-muted-foreground">No ownership records supplied</p> :
        groups.map((group, index) => (
          <dl key={index} className="rounded-md bg-muted/50 p-3 space-y-1 break-words">
            <div><dt className="inline font-medium">Property / resort: </dt>
              <dd className="inline">{group.propertyName}{group.propertyAddress && group.propertyName !== group.communityName ? ` · ${group.communityName}` : ""}</dd></div>
            <div><dt className="inline font-medium">Unit: </dt><dd className="inline">{group.unitNumber}</dd></div>
            <div><dt className="inline font-medium">Weeks owned: </dt>
              <dd className="inline">{group.weeks.length ? group.weeks.join(", ") : "Not supplied"}
                {group.unresolvedWeeks.length > 0 && <span> · Source records (week not specified): {group.unresolvedWeeks.join(", ")}</span>}
              </dd></div>
          </dl>
        ))}
    </section>
  );
}
