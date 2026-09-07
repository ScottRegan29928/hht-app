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
import type * as auth from "../auth.js";
import type * as booking from "../booking.js";
import type * as calendar from "../calendar.js";
import type * as communities from "../communities.js";
import type * as crons from "../crons.js";
import type * as email from "../email.js";
import type * as hostawaySync from "../hostawaySync.js";
import type * as http from "../http.js";
import type * as inquiries from "../inquiries.js";
import type * as migrations from "../migrations.js";
import type * as owner from "../owner.js";
import type * as properties from "../properties.js";
import type * as weeks from "../weeks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  booking: typeof booking;
  calendar: typeof calendar;
  communities: typeof communities;
  crons: typeof crons;
  email: typeof email;
  hostawaySync: typeof hostawaySync;
  http: typeof http;
  inquiries: typeof inquiries;
  migrations: typeof migrations;
  owner: typeof owner;
  properties: typeof properties;
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
