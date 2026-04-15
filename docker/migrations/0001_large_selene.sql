ALTER TABLE "cusip_quarter_investor_activity" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cusip_quarter_investor_activity" ADD PRIMARY KEY ("id");