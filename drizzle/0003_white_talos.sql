CREATE TABLE "cusip_quarter_investor_activity_detail" (
	"id" bigint PRIMARY KEY NOT NULL,
	"cusip" varchar,
	"ticker" varchar,
	"quarter" varchar,
	"cik" bigint,
	"did_open" boolean,
	"did_add" boolean,
	"did_reduce" boolean,
	"did_close" boolean,
	"did_hold" boolean
);