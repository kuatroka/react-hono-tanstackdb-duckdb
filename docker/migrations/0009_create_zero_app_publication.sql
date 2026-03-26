DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'zapp_app') THEN
    CREATE PUBLICATION zapp_app FOR TABLE
      public."user",
      public.medium,
      public.message,
      serving.counters,
      serving.value_quarters,
      serving.entities,
      serving.searches,
      serving.assets,
      serving.superinvestors,
      serving.cusip_quarter_investor_activity,
      app_state.user_counters;
  ELSE
    ALTER PUBLICATION zapp_app SET TABLE
      public."user",
      public.medium,
      public.message,
      serving.counters,
      serving.value_quarters,
      serving.entities,
      serving.searches,
      serving.assets,
      serving.superinvestors,
      serving.cusip_quarter_investor_activity,
      app_state.user_counters;
  END IF;
END $$;
