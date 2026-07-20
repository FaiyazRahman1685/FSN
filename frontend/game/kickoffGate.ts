/** Coordinates React kickoff countdown with Phaser scene start. */

type Gate = {
  promise: Promise<void>;
  resolve: () => void;
};

let gate: Gate | null = null;

function createGate(): Gate {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Call when a new match is about to start (before the canvas mounts). */
export function armKickoffGate() {
  gate = createGate();
}

/** Call when the 3-2-1 overlay finishes. */
export function releaseKickoffGate() {
  gate?.resolve();
  gate = null;
}

/** Scene waits here so gameplay starts after the countdown (and asset load). */
export function waitForKickoffGate() {
  return gate?.promise ?? Promise.resolve();
}
