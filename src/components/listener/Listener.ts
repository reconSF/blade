import { array, isPromise } from "../../util";
import { Module, ModuleOptions } from "../base/Module";

import type { BladeClient } from "../../Client";
import type { ListenerHandler } from "./ListenerHandler";

export class Listener extends Module<ListenerOptions> {
  /**
   * The listeners handler.
   */
  public handler!: ListenerHandler

  /**
   * The events this listener is for.
   */
  public event: string[];

  /**
   * Whether or not this listener is ran once.
   */
  public once: boolean;

  /**
   * The method map.
   */
  public map: Dictionary<string>;

  /**
   * Listeners.
   */
  private _listeners: Dictionary<Fn> = {}

  /**
   * @param client
   * @param options
   */
  public constructor(client: BladeClient, public readonly options: ListenerOptions) {
    super(client, options);

    this.event = array(options.event);
    this.once = options.once ?? false;
    this.map = options.map ?? {};
  }

  /**
   * The emitter to listen on.
   */
  public get emitter(): EventEmitterLike {
    let emitter = this.options.emitter ?? this.client;
    if (typeof emitter === "string") {
      const _emitter = this.handler.emitters[emitter];
      if (!_emitter) throw new Error(`Emitter "${emitter}" does not exist.`);
      emitter = _emitter;
    }

    return emitter;
  }

  /**
   * Called whenever
   */
  public run(...args: unknown[]): void {
    void args;
    return;
  }

  /**
   * @private
   */
  _listen(): this {
    if (!this.enabled) return this;
    if (this.event.length > 1) {
      for (const event of this.event) {
        const map = this.map[event];

        // @ts-ignore
        let fn = this[`on${event.capitalize()}`] as Fn;
        if (map) {
          // @ts-ignore
          const _fn = this[map] as Fn;
          if (_fn) fn = _fn;
        }

        fn = this.wrap(fn).bind(this);
        this.once
          ? this.emitter.once(event, fn)
          : this.emitter.on(event, fn);

        this._listeners[event] = fn;
      }

      return this;
    }

    const event = this.event[0],
      fn = this.wrap(this.run).bind(this);

    this._listeners[event] = fn;
    this.once
      ? this.emitter.once(event, fn)
      : this.emitter.on(event, fn);

    return this;
  }

  /**
   * @private
   */
  _unListen(): Listener {
    for (const event of this.event)
      this.emitter.removeListener(event, this._listeners[event]);

    return this;
  }

  /**
   * Wrap a function.
   * @param fn The function to wrap.
   * @since 1.0.0
   */
  private wrap(fn: Fn): Fn<Promise<void>> {
    return async (...args: unknown[]) => {
      try {
        let res = fn.call(this, ...args);
        if (isPromise(res)) res = await res;
        this.handler.emit("listenerRan", this, res);
      } catch (e) {
        this.handler.emit("listenerError", this, e);
        return;
      }
    };
  }
}

/**
 * A helper decorator for applying options to a listener.
 * @param options The options to apply.
 * @since 2.0.0
 */
export function listener(options: ListenerOptions) {
  return <T extends new (...args: any[]) => Listener>(target: T): T => {
    return class extends target {
      constructor(...args: any[]) {
        super(...args, options);
      }
    };
  };
}

export type Fn<R = unknown> = (...args: unknown[]) => R

export interface ListenerOptions extends ModuleOptions {
  event: string | string[];
  emitter?: string | EventEmitterLike;
  once?: boolean;
  map?: Dictionary<string>;
}
