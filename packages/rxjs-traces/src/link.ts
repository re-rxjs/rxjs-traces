import { Observable, defer } from "rxjs";
import { getMetadata } from "./metadata";

export const createLink = () => {
  const producerEndRefs = new Set<Observable<unknown>>();
  const consumerEndRefs = new Set<Observable<unknown>>();

  const from =
    () =>
    <T>(producer: Observable<T>) => {
      producerEndRefs.add(producer);
      consumerEndRefs.forEach((consumer) => {
        getMetadata(consumer).addDependency(producer);
      });

      return producer;
    };

  const to =
    () =>
    <T>(consumer: Observable<T>) => {
      /**
       * when we use `to` in this example:
       *
       * ```
       *   addDebugTag('tagA')
       *   to()
       *   addDebugTag('tagB')
       * ```
       *
       * we want tagB to have the refs comming from `from()`. This `to` operator
       * is receiving `consumer` the result of `tagA`, so if we append the refs
       * to that observable, we will be appending them to the wrong observable.
       * We need to create a new reference (by using defer) and link that one
       * instead.
       */
      const deferredConsumer = defer(() => consumer);

      consumerEndRefs.add(deferredConsumer);
      producerEndRefs.forEach((producer) => {
        getMetadata(deferredConsumer).addDependency(producer);
      });

      return deferredConsumer;
    };
  return [from, to] as const;
};
