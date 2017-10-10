// NOTE -- 	
//  Commented out to avoid cross origin error produced when running again webpack
//  More research is necessary to resolve, as it may simply be a configuration issue.
//  Repro Steps: Checkout augur `new-contracts` branch + run `yarn dev` to start the dev server.  
//  When accessing within a browser, attempts to get files via XHR produces cross origin errors due the proto being `webpack-internal`
// import * as sourceMapSupport from "source-map-support";
// sourceMapSupport.install();

export { Block } from "./models/block";
export { Log } from "./models/log";
export { Transaction } from "./models/transaction";
export { FilterOptions } from "./models/filters";

export { BlockAndLogStreamer } from "./block-and-log-streamer";
