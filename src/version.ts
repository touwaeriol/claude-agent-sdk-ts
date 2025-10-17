// eslint-disable-next-line @typescript-eslint/no-var-requires -- JSON import for package metadata
const pkg = require("../package.json") as { version: string };

export const SDK_VERSION: string = pkg.version ?? "0.0.0-development";
