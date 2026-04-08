DO $create_postgres_role$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    EXECUTE 'ALTER ROLE postgres WITH LOGIN SUPERUSER PASSWORD ''postgres''';
  ELSE
    EXECUTE 'CREATE ROLE postgres WITH LOGIN SUPERUSER PASSWORD ''postgres''';
  END IF;
END
$create_postgres_role$;
