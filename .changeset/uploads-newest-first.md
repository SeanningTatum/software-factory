---
"create-tanstack-cf-saas": patch
---

In the template, the file list is newest first on every page. An upload's key now starts with its time counted down, so R2's own key order is newest first; before, keys were random and each page was sorted alone. Files stored before this change keep their old keys and sort among the new ones in no useful order.
