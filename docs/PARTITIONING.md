# Log Table Partitioning

Cherrytracer can drop entire partitions instead of deleting millions of rows one by one.

## Why
- `DELETE` on large tables creates bloat and needs `VACUUM`.
- Range partitions can be dropped instantly, reclaiming space without long locks.

## Easiest way (container friendly)
Defaults are on. With no env vars, the API will auto-convert `logs` to daily partitions on boot and keep partitioning enabled. To opt out, set `LOG_PARTITIONING_ENABLED=false` or disable conversion with `LOG_PARTITIONING_AUTOCONVERT=false`. Optional: `LOG_PARTITION_PRECREATE_DAYS=1` pre-creates tomorrow.

On boot the API detects a non-partitioned `logs` table, rebuilds it as partitioned, moves existing rows, drops the old table, and then creates the indexes on the new parent. No manual psql needed.

## What changes at runtime
- Ingestion warms partitions for the current window before inserting.
- The cleanup job drops partitions older than `RETENTION_DAYS` and, when over the soft limit, drops the oldest partition before falling back to row deletes.
