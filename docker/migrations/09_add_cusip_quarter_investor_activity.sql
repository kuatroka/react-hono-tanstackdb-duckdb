CREATE TABLE cusip_quarter_investor_activity (
    id         BIGINT,
    cusip      VARCHAR,
    ticker     VARCHAR,
    quarter    VARCHAR,
    num_open   BIGINT,
    num_add    BIGINT,
    num_reduce BIGINT,
    num_close  BIGINT,
    num_hold   BIGINT
);
