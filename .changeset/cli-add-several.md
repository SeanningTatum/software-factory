---
"create-tanstack-cf-saas": patch
---

`add` and `remove` take several names, with spaces or commas (`add kv workflows`, `add kv,workflows`); before, every name after the first was dropped and a comma list was refused. A rate limiter that `add` brings in gets a random namespace id, as in `create`: it used to get the manifest's fixed id (1001, 1002), which every project on one Cloudflare account then shared. `remove` warns that the next `db:generate` writes `DROP TABLE` for the feature's tables.
