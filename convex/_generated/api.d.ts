/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as amenityDefaults from "../amenityDefaults.js";
import type * as amenitySettings from "../amenitySettings.js";
import type * as auth from "../auth.js";
import type * as booking from "../booking.js";
import type * as calendar from "../calendar.js";
import type * as communities from "../communities.js";
import type * as content from "../content.js";
import type * as crons from "../crons.js";
import type * as goLive from "../goLive.js";
import type * as hostawayApi from "../hostawayApi.js";
import type * as hostawayFields from "../hostawayFields.js";
import type * as hostawaySync from "../hostawaySync.js";
import type * as http from "../http.js";
import type * as inquiries from "../inquiries.js";
import type * as inquiryReplies from "../inquiryReplies.js";
import type * as marketplace from "../marketplace.js";
import type * as marketplaceMatches from "../marketplaceMatches.js";
import type * as mergeDuplicates from "../mergeDuplicates.js";
import type * as migrations from "../migrations.js";
import type * as newsletter from "../newsletter.js";
import type * as owner from "../owner.js";
import type * as ownerAccount from "../ownerAccount.js";
import type * as ownerInvites from "../ownerInvites.js";
import type * as ownerNotices from "../ownerNotices.js";
import type * as ownerPortal from "../ownerPortal.js";
import type * as ownerPortalSeed from "../ownerPortalSeed.js";
import type * as passwordReset from "../passwordReset.js";
import type * as paymentConfig from "../paymentConfig.js";
import type * as photoMirror from "../photoMirror.js";
import type * as prerender from "../prerender.js";
import type * as properties from "../properties.js";
import type * as removeProperty from "../removeProperty.js";
import type * as rentalCheckout from "../rentalCheckout.js";
import type * as salesBackfill from "../salesBackfill.js";
import type * as searchFacets from "../searchFacets.js";
import type * as seoLandingData from "../seoLandingData.js";
import type * as seoShared from "../seoShared.js";
import type * as sites from "../sites.js";
import type * as stayViewerSeed from "../stayViewerSeed.js";
import type * as store from "../store.js";
import type * as weeks from "../weeks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  amenityDefaults: typeof amenityDefaults;
  amenitySettings: typeof amenitySettings;
  auth: typeof auth;
  booking: typeof booking;
  calendar: typeof calendar;
  communities: typeof communities;
  content: typeof content;
  crons: typeof crons;
  goLive: typeof goLive;
  hostawayApi: typeof hostawayApi;
  hostawayFields: typeof hostawayFields;
  hostawaySync: typeof hostawaySync;
  http: typeof http;
  inquiries: typeof inquiries;
  inquiryReplies: typeof inquiryReplies;
  marketplace: typeof marketplace;
  marketplaceMatches: typeof marketplaceMatches;
  mergeDuplicates: typeof mergeDuplicates;
  migrations: typeof migrations;
  newsletter: typeof newsletter;
  owner: typeof owner;
  ownerAccount: typeof ownerAccount;
  ownerInvites: typeof ownerInvites;
  ownerNotices: typeof ownerNotices;
  ownerPortal: typeof ownerPortal;
  ownerPortalSeed: typeof ownerPortalSeed;
  passwordReset: typeof passwordReset;
  paymentConfig: typeof paymentConfig;
  photoMirror: typeof photoMirror;
  prerender: typeof prerender;
  properties: typeof properties;
  removeProperty: typeof removeProperty;
  rentalCheckout: typeof rentalCheckout;
  salesBackfill: typeof salesBackfill;
  searchFacets: typeof searchFacets;
  seoLandingData: typeof seoLandingData;
  seoShared: typeof seoShared;
  sites: typeof sites;
  stayViewerSeed: typeof stayViewerSeed;
  store: typeof store;
  weeks: typeof weeks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
