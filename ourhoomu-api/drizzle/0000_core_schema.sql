CREATE SCHEMA "core";
--> statement-breakpoint
CREATE TABLE "core"."recipient_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"bank_code" text NOT NULL,
	"identifier_kind" text NOT NULL,
	"identifier_ciphertext" text NOT NULL,
	"identifier_digest" text NOT NULL,
	"key_version" integer NOT NULL,
	"label" text NOT NULL,
	"masked_account" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_expires_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	CONSTRAINT "account_owner_pair" UNIQUE("id","owner_user_id"),
	CONSTRAINT "account_valid" CHECK (identifier_kind IN ('bank_account','promptpay') AND identifier_digest ~ '^[0-9a-f]{64}$' AND length(identifier_ciphertext)>0 AND key_version>0 AND length(bank_code) BETWEEN 1 AND 32 AND length(label) BETWEEN 1 AND 100 AND length(masked_account) BETWEEN 1 AND 64 AND state IN ('active','archived') AND version>0 AND ((state='active' AND archived_at IS NULL AND archived_expires_at IS NULL) OR (state='archived' AND archived_at IS NOT NULL AND archived_expires_at>archived_at AND archived_expires_at<=archived_at+interval '8760 hours')))
);
--> statement-breakpoint
CREATE TABLE "core"."activity_events" (
	"house_id" uuid NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"actor_membership_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"bill_id" uuid,
	"occurrence_id" uuid,
	"confirmation_id" uuid,
	"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"retention_deadline_at" timestamp with time zone NOT NULL,
	CONSTRAINT "activity_events_house_id_id_pk" PRIMARY KEY("house_id","id"),
	CONSTRAINT "activities_id_unique" UNIQUE("id"),
	CONSTRAINT "activity_valid" CHECK (NOT(bill_id IS NOT NULL AND occurrence_id IS NOT NULL) AND (confirmation_id IS NULL OR bill_id IS NOT NULL)),
	CONSTRAINT "activities_history" CHECK (created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours')
);
--> statement-breakpoint
CREATE TABLE "core"."payment_attempts" (
	"house_id" uuid NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"payer_membership_id" uuid NOT NULL,
	"method" text NOT NULL,
	"amount_satang" bigint NOT NULL,
	"status" text NOT NULL,
	"reservation_until" timestamp with time zone NOT NULL,
	"reservation_released_at" timestamp with time zone,
	"decision_by_membership_id" uuid,
	"decided_at" timestamp with time zone,
	"rejection_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"retention_deadline_at" timestamp with time zone NOT NULL,
	CONSTRAINT "payment_attempts_house_id_id_pk" PRIMARY KEY("house_id","id"),
	CONSTRAINT "attempts_id_unique" UNIQUE("id"),
	CONSTRAINT "attempt_bill_payer_tuple" UNIQUE("house_id","bill_id","id","payer_membership_id"),
	CONSTRAINT "attempt_valid" CHECK (amount_satang BETWEEN 1 AND 900000000000 AND version>0 AND created_at<reservation_until AND reservation_until<=expires_at AND ((method='cash' AND status IN ('awaiting_confirmation','confirmed','rejected','cancelled')) OR (method='transfer' AND status IN ('awaiting_upload','verifying','pending_verification','needs_attention','cancelled'))) AND (status NOT IN ('confirmed','rejected','cancelled') OR reservation_released_at IS NOT NULL)),
	CONSTRAINT "attempts_history" CHECK (created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours')
);
--> statement-breakpoint
CREATE TABLE "core"."bills" (
	"house_id" uuid NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"creator_membership_id" uuid NOT NULL,
	"recipient_membership_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"emoji" text,
	"total_satang" bigint NOT NULL,
	"currency" text DEFAULT 'THB' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"due_date" date NOT NULL,
	"published_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"retention_deadline_at" timestamp with time zone NOT NULL,
	CONSTRAINT "bills_house_id_id_pk" PRIMARY KEY("house_id","id"),
	CONSTRAINT "bills_id_unique" UNIQUE("id"),
	CONSTRAINT "bill_recipient_tuple" UNIQUE("house_id","id","recipient_membership_id","recipient_user_id"),
	CONSTRAINT "bills_history" CHECK (created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours'),
	CONSTRAINT "bill_valid" CHECK (total_satang BETWEEN 1 AND 900000000000 AND currency='THB' AND length(title) BETWEEN 1 AND 200 AND status IN ('draft','open','settled','voided') AND version>0 AND (emoji IS NULL OR length(emoji)<=8))
);
--> statement-breakpoint
CREATE TABLE "core"."auth_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"proof_digest" text NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "challenge_proof" UNIQUE("proof_digest"),
	CONSTRAINT "challenge_valid" CHECK (provider IN ('google','apple') AND proof_digest ~ '^[0-9a-f]{64}$' AND expires_at > created_at AND expires_at <= created_at + interval '5 minutes')
);
--> statement-breakpoint
CREATE TABLE "core"."chore_completion_events" (
	"house_id" uuid NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"actor_membership_id" uuid NOT NULL,
	"transition_version" integer NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"retention_deadline_at" timestamp with time zone NOT NULL,
	CONSTRAINT "chore_completion_events_house_id_id_pk" PRIMARY KEY("house_id","id"),
	CONSTRAINT "completion_events_id_unique" UNIQUE("id"),
	CONSTRAINT "completion_once" UNIQUE("house_id","occurrence_id","transition_version"),
	CONSTRAINT "completion_valid" CHECK (transition_version>0 AND action IN ('completed','reopened')),
	CONSTRAINT "completion_events_history" CHECK (created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours')
);
--> statement-breakpoint
CREATE TABLE "core"."payment_confirmations" (
	"house_id" uuid NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"payer_membership_id" uuid NOT NULL,
	"actor_membership_id" uuid NOT NULL,
	"amount_satang" bigint NOT NULL,
	"self_confirmed" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"retention_deadline_at" timestamp with time zone NOT NULL,
	CONSTRAINT "payment_confirmations_house_id_id_pk" PRIMARY KEY("house_id","id"),
	CONSTRAINT "confirmations_id_unique" UNIQUE("id"),
	CONSTRAINT "confirmation_once" UNIQUE("house_id","attempt_id"),
	CONSTRAINT "credit_valid" CHECK (amount_satang BETWEEN 1 AND 900000000000),
	CONSTRAINT "confirmations_history" CHECK (created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours')
);
--> statement-breakpoint
CREATE TABLE "core"."houses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Bangkok' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	CONSTRAINT "house_valid" CHECK (length(name) BETWEEN 1 AND 100 AND state IN ('active','archived') AND version>0)
);
--> statement-breakpoint
CREATE TABLE "core"."idempotency_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"house_id" uuid,
	"route_scope" text NOT NULL,
	"key_digest" text NOT NULL,
	"request_hash" text NOT NULL,
	"resource_kind" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"replay_ciphertext" text,
	"replay_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"retention_deadline_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_key" UNIQUE("actor_user_id","route_scope","key_digest"),
	CONSTRAINT "idempotency_valid" CHECK (key_digest ~ '^[0-9a-f]{64}$' AND request_hash ~ '^[0-9a-f]{64}$' AND length(route_scope) BETWEEN 1 AND 300 AND (replay_until IS NULL OR replay_until<=created_at+interval '5 minutes')),
	CONSTRAINT "idempotency_history" CHECK (created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours')
);
--> statement-breakpoint
CREATE TABLE "core"."auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"provider" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	CONSTRAINT "identity_issuer_subject" UNIQUE("issuer","subject"),
	CONSTRAINT "identity_valid" CHECK (provider IN ('google','apple') AND length(issuer) BETWEEN 1 AND 512 AND length(subject) BETWEEN 1 AND 512)
);
--> statement-breakpoint
CREATE TABLE "core"."house_invitations" (
	"house_id" uuid NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"creator_membership_id" uuid NOT NULL,
	"token_digest" text NOT NULL,
	"consumed_by_user_id" uuid,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"retention_deadline_at" timestamp with time zone NOT NULL,
	CONSTRAINT "house_invitations_house_id_id_pk" PRIMARY KEY("house_id","id"),
	CONSTRAINT "invitations_id_unique" UNIQUE("id"),
	CONSTRAINT "invite_digest" UNIQUE("token_digest"),
	CONSTRAINT "invitations_history" CHECK (created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours'),
	CONSTRAINT "invite_valid" CHECK (token_digest ~ '^[0-9a-f]{64}$' AND expires_at<=created_at+interval '168 hours' AND ((consumed_at IS NULL)=(consumed_by_user_id IS NULL)))
);
--> statement-breakpoint
CREATE TABLE "core"."house_memberships" (
	"house_id" uuid NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"left_at" timestamp with time zone,
	"archived_expires_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	CONSTRAINT "house_memberships_house_id_id_pk" PRIMARY KEY("house_id","id"),
	CONSTRAINT "memberships_id_unique" UNIQUE("id"),
	CONSTRAINT "member_house_user" UNIQUE("house_id","user_id"),
	CONSTRAINT "member_house_id_user" UNIQUE("house_id","id","user_id"),
	CONSTRAINT "member_valid" CHECK (role IN ('owner','member') AND state IN ('active','left','removed') AND version>0 AND ((state='active' AND left_at IS NULL AND archived_expires_at IS NULL) OR (state<>'active' AND left_at IS NOT NULL AND archived_expires_at>left_at AND archived_expires_at<=left_at+interval '8760 hours')))
);
--> statement-breakpoint
CREATE TABLE "core"."chore_occurrences" (
	"house_id" uuid NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid,
	"schedule_revision" integer,
	"local_date" date NOT NULL,
	"timezone" text NOT NULL,
	"title" text NOT NULL,
	"emoji" text,
	"creator_membership_id" uuid NOT NULL,
	"assignee_membership_id" uuid,
	"assignee_name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"rotation_ordinal" bigint,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"retention_deadline_at" timestamp with time zone NOT NULL,
	CONSTRAINT "chore_occurrences_house_id_id_pk" PRIMARY KEY("house_id","id"),
	CONSTRAINT "occurrences_id_unique" UNIQUE("id"),
	CONSTRAINT "occurrence_schedule_date" UNIQUE("house_id","schedule_id","local_date"),
	CONSTRAINT "occurrence_valid" CHECK (version>0 AND length(title) BETWEEN 1 AND 200 AND status IN ('pending','completed','cancelled') AND ((schedule_id IS NULL)=(schedule_revision IS NULL)) AND ((status='completed')=(completed_at IS NOT NULL)) AND (status<>'completed' OR assignee_membership_id IS NOT NULL)),
	CONSTRAINT "occurrences_history" CHECK (created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours')
);
--> statement-breakpoint
CREATE TABLE "core"."activity_read_state" (
	"house_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_seen_id" uuid,
	"updated_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	CONSTRAINT "activity_read_state_house_id_membership_id_pk" PRIMARY KEY("house_id","membership_id"),
	CONSTRAINT "cursor_valid" CHECK (((last_seen_at IS NULL)=(last_seen_id IS NULL)))
);
--> statement-breakpoint
CREATE TABLE "core"."chore_revisions" (
	"house_id" uuid NOT NULL,
	"schedule_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"title" text NOT NULL,
	"emoji" text,
	"mode" text NOT NULL,
	"timezone" text NOT NULL,
	"anchor_date" date NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"frequency" text NOT NULL,
	"weekdays" integer[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	"superseded_at" timestamp with time zone,
	"archive_expires_at" timestamp with time zone,
	CONSTRAINT "chore_revisions_house_id_schedule_id_revision_pk" PRIMARY KEY("house_id","schedule_id","revision"),
	CONSTRAINT "revision_valid" CHECK (revision>0 AND length(title) BETWEEN 1 AND 200 AND mode IN ('repeat','rotation') AND frequency IN ('daily','weekly') AND anchor_date<=start_date AND (end_date IS NULL OR end_date>=start_date) AND weekdays <@ ARRAY[0,1,2,3,4,5,6] AND ((frequency='daily' AND cardinality(weekdays)=0) OR (frequency='weekly' AND cardinality(weekdays)>0)))
);
--> statement-breakpoint
CREATE TABLE "core"."chore_rotation_members" (
	"house_id" uuid NOT NULL,
	"schedule_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"position" integer NOT NULL,
	"membership_id" uuid NOT NULL,
	CONSTRAINT "chore_rotation_members_house_id_schedule_id_revision_position_pk" PRIMARY KEY("house_id","schedule_id","revision","position"),
	CONSTRAINT "rotation_member_unique" UNIQUE("house_id","schedule_id","revision","membership_id"),
	CONSTRAINT "rotation_valid" CHECK (position>=0)
);
--> statement-breakpoint
CREATE TABLE "core"."chore_schedules" (
	"house_id" uuid NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"creator_membership_id" uuid NOT NULL,
	"active_revision" integer DEFAULT 1 NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	CONSTRAINT "chore_schedules_house_id_id_pk" PRIMARY KEY("house_id","id"),
	CONSTRAINT "schedules_id_unique" UNIQUE("id"),
	CONSTRAINT "schedule_valid" CHECK (version>0 AND active_revision>0 AND state IN ('active','archived'))
);
--> statement-breakpoint
CREATE TABLE "core"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"identity_id" uuid NOT NULL,
	"access_digest" text NOT NULL,
	"refresh_digest" text NOT NULL,
	"family_id" uuid NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"auth_time" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"refresh_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"rotated_at" timestamp with time zone,
	"replay_key_digest" text,
	"replay_body_hash" text,
	"replay_ciphertext" text,
	"replay_until" timestamp with time zone,
	CONSTRAINT "session_access" UNIQUE("access_digest"),
	CONSTRAINT "session_refresh" UNIQUE("refresh_digest"),
	CONSTRAINT "session_valid" CHECK (generation>0 AND access_digest ~ '^[0-9a-f]{64}$' AND refresh_digest ~ '^[0-9a-f]{64}$' AND created_at<expires_at AND expires_at<=refresh_expires_at AND refresh_expires_at<=created_at+interval '8760 hours')
);
--> statement-breakpoint
CREATE TABLE "core"."bill_shares" (
	"house_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"basis_points" integer NOT NULL,
	"amount_satang" bigint,
	"self_covered" boolean DEFAULT false NOT NULL,
	"member_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"retention_deadline_at" timestamp with time zone NOT NULL,
	CONSTRAINT "bill_shares_house_id_bill_id_membership_id_pk" PRIMARY KEY("house_id","bill_id","membership_id"),
	CONSTRAINT "share_valid" CHECK (basis_points BETWEEN 1 AND 10000 AND (amount_satang IS NULL OR amount_satang BETWEEN 0 AND 900000000000) AND (NOT self_covered OR amount_satang IS NOT NULL)),
	CONSTRAINT "shares_history" CHECK (created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours')
);
--> statement-breakpoint
CREATE TABLE "core"."bill_recipient_snapshots" (
	"house_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"recipient_membership_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"source_account_id" uuid NOT NULL,
	"account_version" integer NOT NULL,
	"bank_code" text NOT NULL,
	"identifier_kind" text NOT NULL,
	"identifier_ciphertext" text NOT NULL,
	"identifier_digest" text NOT NULL,
	"key_version" integer NOT NULL,
	"masked_account" text NOT NULL,
	"recipient_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"retention_deadline_at" timestamp with time zone NOT NULL,
	CONSTRAINT "bill_recipient_snapshots_house_id_bill_id_pk" PRIMARY KEY("house_id","bill_id"),
	CONSTRAINT "snapshots_history" CHECK (created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours')
);
--> statement-breakpoint
CREATE TABLE "core"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"locale" text DEFAULT 'th' NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
	CONSTRAINT "user_valid" CHECK (length(display_name) BETWEEN 1 AND 100 AND locale IN ('th','en') AND state IN ('active','deletion_pending'))
);
--> statement-breakpoint
ALTER TABLE "core"."recipient_accounts" ADD CONSTRAINT "account_user_fk" FOREIGN KEY ("owner_user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."activity_events" ADD CONSTRAINT "activities_house_fk" FOREIGN KEY ("house_id") REFERENCES "core"."houses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."activity_events" ADD CONSTRAINT "activity_actor_fk" FOREIGN KEY ("house_id","actor_membership_id") REFERENCES "core"."house_memberships"("house_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."activity_events" ADD CONSTRAINT "activity_bill_fk" FOREIGN KEY ("house_id","bill_id") REFERENCES "core"."bills"("house_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."activity_events" ADD CONSTRAINT "activity_occurrence_fk" FOREIGN KEY ("house_id","occurrence_id") REFERENCES "core"."chore_occurrences"("house_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."payment_attempts" ADD CONSTRAINT "attempts_house_fk" FOREIGN KEY ("house_id") REFERENCES "core"."houses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."payment_attempts" ADD CONSTRAINT "attempt_share_fk" FOREIGN KEY ("house_id","bill_id","payer_membership_id") REFERENCES "core"."bill_shares"("house_id","bill_id","membership_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."payment_attempts" ADD CONSTRAINT "attempt_decider_fk" FOREIGN KEY ("house_id","decision_by_membership_id") REFERENCES "core"."house_memberships"("house_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."bills" ADD CONSTRAINT "bills_house_fk" FOREIGN KEY ("house_id") REFERENCES "core"."houses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."bills" ADD CONSTRAINT "bill_creator_fk" FOREIGN KEY ("house_id","creator_membership_id") REFERENCES "core"."house_memberships"("house_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."bills" ADD CONSTRAINT "bill_recipient_fk" FOREIGN KEY ("house_id","recipient_membership_id","recipient_user_id") REFERENCES "core"."house_memberships"("house_id","id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chore_completion_events" ADD CONSTRAINT "completion_events_house_fk" FOREIGN KEY ("house_id") REFERENCES "core"."houses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chore_completion_events" ADD CONSTRAINT "completion_occurrence_fk" FOREIGN KEY ("house_id","occurrence_id") REFERENCES "core"."chore_occurrences"("house_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chore_completion_events" ADD CONSTRAINT "completion_actor_fk" FOREIGN KEY ("house_id","actor_membership_id") REFERENCES "core"."house_memberships"("house_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."payment_confirmations" ADD CONSTRAINT "confirmations_house_fk" FOREIGN KEY ("house_id") REFERENCES "core"."houses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."payment_confirmations" ADD CONSTRAINT "confirmation_attempt_fk" FOREIGN KEY ("house_id","bill_id","attempt_id","payer_membership_id") REFERENCES "core"."payment_attempts"("house_id","bill_id","id","payer_membership_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."payment_confirmations" ADD CONSTRAINT "confirmation_actor_fk" FOREIGN KEY ("house_id","actor_membership_id") REFERENCES "core"."house_memberships"("house_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."houses" ADD CONSTRAINT "house_creator_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."idempotency_records" ADD CONSTRAINT "idempotency_user_fk" FOREIGN KEY ("actor_user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."idempotency_records" ADD CONSTRAINT "idempotency_house_fk" FOREIGN KEY ("house_id") REFERENCES "core"."houses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."auth_identities" ADD CONSTRAINT "identity_user_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."house_invitations" ADD CONSTRAINT "invitations_house_fk" FOREIGN KEY ("house_id") REFERENCES "core"."houses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."house_invitations" ADD CONSTRAINT "invite_creator_fk" FOREIGN KEY ("house_id","creator_membership_id") REFERENCES "core"."house_memberships"("house_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."house_invitations" ADD CONSTRAINT "invite_consumer_fk" FOREIGN KEY ("consumed_by_user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."house_memberships" ADD CONSTRAINT "memberships_house_fk" FOREIGN KEY ("house_id") REFERENCES "core"."houses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."house_memberships" ADD CONSTRAINT "member_user_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chore_occurrences" ADD CONSTRAINT "occurrences_house_fk" FOREIGN KEY ("house_id") REFERENCES "core"."houses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chore_occurrences" ADD CONSTRAINT "occurrence_revision_fk" FOREIGN KEY ("house_id","schedule_id","schedule_revision") REFERENCES "core"."chore_revisions"("house_id","schedule_id","revision") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chore_occurrences" ADD CONSTRAINT "occurrence_creator_fk" FOREIGN KEY ("house_id","creator_membership_id") REFERENCES "core"."house_memberships"("house_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chore_occurrences" ADD CONSTRAINT "occurrence_assignee_fk" FOREIGN KEY ("house_id","assignee_membership_id") REFERENCES "core"."house_memberships"("house_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."activity_read_state" ADD CONSTRAINT "cursor_member_fk" FOREIGN KEY ("house_id","membership_id") REFERENCES "core"."house_memberships"("house_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chore_revisions" ADD CONSTRAINT "revision_schedule_fk" FOREIGN KEY ("house_id","schedule_id") REFERENCES "core"."chore_schedules"("house_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chore_rotation_members" ADD CONSTRAINT "rotation_revision_fk" FOREIGN KEY ("house_id","schedule_id","revision") REFERENCES "core"."chore_revisions"("house_id","schedule_id","revision") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chore_rotation_members" ADD CONSTRAINT "rotation_member_fk" FOREIGN KEY ("house_id","membership_id") REFERENCES "core"."house_memberships"("house_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chore_schedules" ADD CONSTRAINT "schedules_house_fk" FOREIGN KEY ("house_id") REFERENCES "core"."houses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chore_schedules" ADD CONSTRAINT "schedule_creator_fk" FOREIGN KEY ("house_id","creator_membership_id") REFERENCES "core"."house_memberships"("house_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."sessions" ADD CONSTRAINT "session_user_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."sessions" ADD CONSTRAINT "session_identity_fk" FOREIGN KEY ("identity_id") REFERENCES "core"."auth_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."bill_shares" ADD CONSTRAINT "share_bill_fk" FOREIGN KEY ("house_id","bill_id") REFERENCES "core"."bills"("house_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."bill_shares" ADD CONSTRAINT "share_member_fk" FOREIGN KEY ("house_id","membership_id") REFERENCES "core"."house_memberships"("house_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."bill_recipient_snapshots" ADD CONSTRAINT "snapshot_bill_recipient_fk" FOREIGN KEY ("house_id","bill_id","recipient_membership_id","recipient_user_id") REFERENCES "core"."bills"("house_id","id","recipient_membership_id","recipient_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_owner_idx" ON "core"."recipient_accounts" USING btree ("owner_user_id","state");--> statement-breakpoint
CREATE INDEX "activity_feed_idx" ON "core"."activity_events" USING btree ("house_id","created_at","id");--> statement-breakpoint
CREATE INDEX "activities_expiry_idx" ON "core"."activity_events" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "attempt_reserved_idx" ON "core"."payment_attempts" USING btree ("house_id","bill_id","payer_membership_id","status","reservation_until");--> statement-breakpoint
CREATE INDEX "attempts_expiry_idx" ON "core"."payment_attempts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "bills_expiry_idx" ON "core"."bills" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "bill_feed_idx" ON "core"."bills" USING btree ("house_id","created_at","id");--> statement-breakpoint
CREATE INDEX "completion_events_expiry_idx" ON "core"."chore_completion_events" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "confirmations_expiry_idx" ON "core"."payment_confirmations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idempotency_expiry_idx" ON "core"."idempotency_records" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "invitations_expiry_idx" ON "core"."house_invitations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "member_user_active" ON "core"."house_memberships" USING btree ("user_id","state","house_id");--> statement-breakpoint
CREATE INDEX "occurrence_dates_idx" ON "core"."chore_occurrences" USING btree ("house_id","local_date","id");--> statement-breakpoint
CREATE INDEX "occurrences_expiry_idx" ON "core"."chore_occurrences" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "shares_expiry_idx" ON "core"."bill_shares" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "snapshots_expiry_idx" ON "core"."bill_recipient_snapshots" USING btree ("expires_at");