CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_id" text NOT NULL,
	"shared_user_ids" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "todos" (
	"id" text PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text NOT NULL,
	"user_ids" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- user table already exists (managed by zero-hono-react-counter-uplot)
-- CREATE TABLE "user" (
-- 	"id" text PRIMARY KEY NOT NULL,
-- 	"name" text NOT NULL,
-- 	"partner" boolean NOT NULL
-- );
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_projects_owner" ON "projects" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_projects_created" ON "projects" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_todos_project" ON "todos" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_todos_user" ON "todos" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_todos_completed" ON "todos" USING btree ("completed");