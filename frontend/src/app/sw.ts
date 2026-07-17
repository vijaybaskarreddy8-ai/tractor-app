import { defaultCache } from "@serwist/next/worker";
import { type PrecacheEntry, Serwist } from "serwist";

declare const self: any;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    concurrency: 10,
  },
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
