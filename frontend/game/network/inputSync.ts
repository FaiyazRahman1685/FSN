import type { InputKeys } from "./api";

export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;

export type RemoteInputState = {
  left: boolean;
  right: boolean;
  pass: boolean;
  passPressed: boolean;
};

export class InputSyncBridge {
  private remoteKeys: InputKeys = { left: false, right: false, pass: false };
  private previousRemotePass = false;
  private currentTick = 0;
  private onSend?: (tick: number, keys: InputKeys) => void;

  setSender(onSend: (tick: number, keys: InputKeys) => void) {
    this.onSend = onSend;
  }

  reset(startedAt?: string) {
    this.currentTick = 0;
    this.remoteKeys = { left: false, right: false, pass: false };
    this.previousRemotePass = false;
    if (startedAt) {
      const elapsed = Date.now() - new Date(startedAt).getTime();
      this.currentTick = Math.max(0, Math.floor(elapsed / TICK_MS));
    }
  }

  applyFrame(tick: number, inputs: Array<{ slot: number; keys: InputKeys }>, localSlot: 1 | 2) {
    const remoteSlot = localSlot === 1 ? 2 : 1;
    const remote = inputs.find((input) => input.slot === remoteSlot);
    if (remote) {
      this.remoteKeys = { ...remote.keys };
    }
    if (tick >= this.currentTick) {
      this.currentTick = tick + 1;
    }
  }

  getRemoteInput(): RemoteInputState {
    const passPressed = this.remoteKeys.pass && !this.previousRemotePass;
    this.previousRemotePass = this.remoteKeys.pass;
    return {
      left: this.remoteKeys.left,
      right: this.remoteKeys.right,
      pass: this.remoteKeys.pass,
      passPressed,
    };
  }

  publishLocalInput(keys: InputKeys) {
    this.onSend?.(this.currentTick, keys);
    this.currentTick += 1;
  }
}

export type InputSyncBridgeRef = {
  current: InputSyncBridge | null;
};
