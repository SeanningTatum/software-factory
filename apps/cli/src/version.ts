import pkg from "../package.json" with { type: "json" };

/** This CLI's version, from its package.json (inlined by the build). */
export const VERSION: string = pkg.version;
