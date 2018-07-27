import { Log } from "./log";
import { List as ImmutableList } from "immutable";

export type LogHistory<TLog extends Log> = ImmutableList<TLog>;
