import { createContext } from "react";
import { noop } from "rxjs";

export const CopyContext = createContext<(text: string) => void>(noop);
