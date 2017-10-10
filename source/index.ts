// NOTE -- Commented out to avoid cross origin error when run via webpack
// import * as sourceMapSupport from "source-map-support";
// sourceMapSupport.install();

export { Block } from "./models/block";
export { Log } from "./models/log";
export { Transaction } from "./models/transaction";
export { FilterOptions } from "./models/filters";

export { BlockAndLogStreamer } from "./block-and-log-streamer";
