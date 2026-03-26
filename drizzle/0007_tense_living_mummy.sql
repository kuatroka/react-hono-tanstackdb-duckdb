CREATE INDEX "idx_assets_asset" ON "assets" USING btree ("asset");--> statement-breakpoint
CREATE INDEX "idx_assets_cusip" ON "assets" USING btree ("cusip");--> statement-breakpoint
CREATE INDEX "idx_cusip_quarter_activity_cusip_quarter" ON "cusip_quarter_investor_activity" USING btree ("cusip","quarter");--> statement-breakpoint
CREATE INDEX "idx_cusip_quarter_activity_ticker_quarter" ON "cusip_quarter_investor_activity" USING btree ("ticker","quarter");