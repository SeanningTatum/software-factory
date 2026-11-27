# @seanningtatum/software-factory-biome-config

## 0.3.0

### Minor Changes

- a1fdbf2: Renamed from `create-tanstack-cf-saas` and `@tanstack-cf-saas/*`: the CLI is `create-software-factory` and
  the packages are `@seanningtatum/software-factory-*`. The bins are now
  `software-factory-blocks` and `software-factory-lint`, and a project's config files are
  `software-factory.json` and `software-factory-lint.json`. A project made with the old names must
  rename those two files and its dependencies by hand.

## 0.2.0

### Minor Changes

- 9dbd52b: Biome's `useArraySortCompare` is on: every `sort()` names its order. `blocks` and `lint` sort by code unit, as before, so generated files do not change.
