import { describe, expect, test } from "bun:test";
import { cancellationMatches } from "../convex/bookingReconciliation";
import { reviewVisible, publicReview } from "../convex/reviewPolicy";

const s = { _id: "s", status: "confirmed", propertyId: "p", checkIn: "2027-01-24",
  checkOut: "2027-01-25", calendarBookingId: "h", bookingId: "b", hostawayReservationId: 123 };
const prop = { hostawayId: 392457 };
const reservation = { id: 123, status: "cancelled", listingMapId: 392457, arrivalDate: "2027-01-24", departureDate: "2027-01-25" };
const hold = { _id: "h", source: "hht", propertyId: "p", startDate: s.checkIn, endDate: s.checkOut };
const booking = { _id: "b", checkoutSessionId: "s", hostawayReservationId: 123 };
describe("Cancellation safety", () => {
  test("releases only exact linked cancellation", () => expect(cancellationMatches(s, prop, reservation, hold, booking)).toBe(true));
  for (const patch of [{status:"confirmed"}, {id:999}, {listingMapId:999}, {arrivalDate:"2027-01-23"}, {departureDate:"2027-01-26"}]) {
    test(`retains hold for ${JSON.stringify(patch)}`, () => expect(cancellationMatches(s, prop, {...reservation,...patch}, hold, booking)).toBe(false));
  }
  test("missing reservation retains hold", () => expect(cancellationMatches(s, prop, null, hold, booking)).toBe(false));
  test("manual hold is never released", () => expect(cancellationMatches(s, prop, reservation, {...hold,source:"manual"}, booking)).toBe(false));
  test("different booking is never released", () => expect(cancellationMatches(s, prop, reservation, hold, {...booking,checkoutSessionId:"other"})).toBe(false));
  test("repeat cancellation is harmless", () => expect(cancellationMatches({...s,status:"canceled"}, prop, reservation, null, booking)).toBe(false));
});
describe("Review publication privacy", () => {
  const review = { type:"guest-to-host",status:"published",isHidden:0,isCancelled:0,bookingEngineVisibility:1,publicReview:"Enjoyed the stay" };
  test("eligible guest review is visible", () => expect(reviewVisible(review)).toBe(true));
  for (const patch of [{type:"host-to-guest"},{status:"submitted"},{isHidden:1},{isCancelled:1},{bookingEngineVisibility:0},{publicReview:""}]) {
    test(`excludes ${JSON.stringify(patch)}`, () => expect(reviewVisible({...review,...patch})).toBe(false));
  }
  test("public projection strips private fields", () => {
    const row = publicReview({_id:"r", guestFirstName:"Justin", body:"Good",reviewedAt:"2026-10-29",privateFeedback:"secret",email:"private",response:"Thank you"});
    expect(Object.keys(row).sort()).toEqual(["_id","guestFirstName","body","reviewedAt","response"].sort());
  });
});

import { apply } from "../convex/cancellationSync";
import { saveResponse, setHidden, importBatch } from "../convex/guestReviews";

function database(initial: any[]) {
  const rows = new Map(initial.map(r => [r._id, structuredClone(r)]));
  return { rows, get: async (id: string) => rows.get(id) ?? null,
    delete: async (id: string) => { rows.delete(id); },
    patch: async (id: string, patch: any) => { Object.assign(rows.get(id), patch); },
    insert: async (table: string, doc: any) => { const id = table + rows.size; rows.set(id, {_id:id,...doc}); return id; },
    query: (table: string) => ({
      collect: async () => [...rows.values()].filter(r => r._table === table),
      withIndex: (_index: string, fn: any) => {
        let field = "", value: any;
        fn({eq: (f: string, v: any) => {field=f;value=v;}});
        const matching = () => [...rows.values()].find(r => r._table === table && r[field] === value) ?? null;
        return {first: async () => matching(), unique: async () => matching()};
      },
    }),
  };
}

describe("Mutation behavior", () => {
  test("dry run is non-destructive; actual cancellation releases once without touching payment", async () => {
    const db = database([s,{...prop,_id:"p"},hold,booking]);
    const ctx = {db};
    const before = JSON.stringify([...db.rows]);
    const args = {sessionId:"s",reservation,dryRun:true};
    expect(await (apply as any)._handler(ctx,args)).toMatchObject({wouldRelease:true,released:false});
    expect(JSON.stringify([...db.rows])).toBe(before);
    expect(await (apply as any)._handler(ctx,{...args,dryRun:false})).toMatchObject({released:true});
    expect(db.rows.has("h")).toBe(false);
    expect(db.rows.get("s").status).toBe("canceled");
    expect(db.rows.get("b").status).toBe("cancelled");
    expect(await (apply as any)._handler(ctx,{...args,dryRun:false})).toMatchObject({released:false});
  });
  test("HTTP error retains the hold and records the failure", async () => {
    const db = database([s,hold]);
    await (apply as any)._handler({db},{sessionId:"s",error:"HTTP 500",dryRun:false});
    expect(db.rows.has("h")).toBe(true);
    expect(db.rows.get("s").status).toBe("confirmed");
    expect(db.rows.get("s").cancellationSyncError).toBe("HTTP 500");
  });
  for (const fn of [saveResponse,setHidden]) {
    test("signed-out callers cannot change reviews", async () => {
      const ctx = {auth:{getUserIdentity:async () => null}};
      expect((fn as any)._handler(ctx,{reviewId:"r",body:"test",hidden:true})).rejects.toThrow("Not signed in");
    });
  }
  test("review refresh preserves a management response and site moderation", async () => {
    const db = database([{_id:"p",_table:"properties",hostawayId:392457},
      {_id:"r",_table:"guestReviews",hostawayReviewId:12,response:"Thanks for staying",hiddenOnSite:true}]);
    await (importBatch as any)._handler({db},{syncedAt:100,rows:[{id:12,listingMapId:392457,
      reviewerName:"Jane Doe",type:"guest-to-host",status:"published",isHidden:0,isCancelled:0,
      bookingEngineVisibility:1,publicReview:"Updated review",privateFeedback:"Never public"}]});
    expect(db.rows.get("r")).toMatchObject({body:"Updated review",response:"Thanks for staying",hiddenOnSite:true,guestFirstName:"Jane"});
    expect(db.rows.get("r").privateFeedback).toBeUndefined();
  });
});

test("rental admin response is audited and returned publicly; an owner cannot publish", async () => {
  const db = database([{_id:"profile",_table:"userProfiles",userId:"user",role:"admin_rental"},
    {_id:"r",_table:"guestReviews",body:"Great stay",guestFirstName:"Jane",reviewedAt:"2026-10-29"}]);
  const ctx = {db,auth:{getUserIdentity:async () => ({subject:"user|session"})}};
  await (saveResponse as any)._handler(ctx,{reviewId:"r",body:"Thank you for staying with us."});
  expect(publicReview(db.rows.get("r")).response).toBe("Thank you for staying with us.");
  expect([...db.rows.values()].some(r => r.authorProfileId === "profile" && r.body === "Thank you for staying with us.")).toBe(true);
  db.rows.get("profile").role = "owner";
  expect((saveResponse as any)._handler(ctx,{reviewId:"r",body:"Not allowed"})).rejects.toThrow("Rental admin access required");
});
