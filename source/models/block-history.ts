import { Block } from "./block";
import { List as ImmutableList } from "immutable";

export type BlockHistory<TBlock extends Block> = ImmutableList<TBlock>;
