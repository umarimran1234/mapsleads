import type { Job as DbJob, Lead as DbLead, Search as DbSearch } from "@/db/schema";

// Dates arrive as ISO strings once the rows have been through JSON.
type Serialized<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K] };

export type Job = Serialized<DbJob>;
export type Lead = Serialized<DbLead>;
/** A deep search plus the live numbers listSearches() adds. */
export type DeepSearch = Serialized<DbSearch> & { leads: number; withWebsite: number; withEmail: number; uniqueEmails: number };

export const LEAD_STATUSES = ["new", "contacted", "replied", "won", "lost"] as const;
