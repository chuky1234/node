'use strict';

const {
  ArrayPrototypeJoin,
  ArrayPrototypePush,
  ObjectCreate,
  Promise,
  PromiseResolve,
} = primordials;

const { CSI } = require('internal/readline/utils');
const { validateBoolean, validateInteger } = require('internal/validators');
const { isWritable } = require('internal/streams/utils');
const { codes: { ERR_INVALID_ARG_TYPE } } = require('internal/errors');

const {
  kClearToLineBeginning,
  kClearToLineEnd,
  kClearLine,
  kClearScreenDown,
} = CSI;

class Readline {
  #autoCommit = false;
  #stream;
  #todo = [];

  constructor(stream, options = ObjectCreate(null)) {
    if (!isWritable(stream))
      throw new ERR_INVALID_ARG_TYPE('stream', 'Writable', stream);
    this.#stream = stream;
    if (options.autoCommit != null) {
      validateBoolean(options, 'autoCommit');
      this.#autoCommit = options.autoCommit;
    }
  }

  /**
   * Moves the cursor to the x and y coordinate on the given stream.
   * @param {integer} x
   * @param {integer} [y]
   */
  cursorTo(x, y = undefined) {
    validateInteger(x, 'x');
    if (y != null) validateInteger(y, 'y');

    const data = y == null ? CSI`${x + 1}G` : CSI`${y + 1};${x + 1}H`;
    if (this.#autoCommit) process.nextTick(() => this.#stream.write(data));
    else ArrayPrototypePush(this.#todo, data);

    return this;
  }

  /**
   * Moves the cursor relative to its current location.
   * @param {integer} dx
   * @param {integer} dy
   */
  moveCursor(dx, dy) {
    if (dx || dy) {
      validateInteger(dx, 'dx');
      validateInteger(dy, 'dy');

      let data = '';

      if (dx < 0) {
        data += CSI`${-dx}D`;
      } else if (dx > 0) {
        data += CSI`${dx}C`;
      }

      if (dy < 0) {
        data += CSI`${-dy}A`;
      } else if (dy > 0) {
        data += CSI`${dy}B`;
      }
      if (this.#autoCommit) process.nextTick(() => this.#stream.write(data));
      else ArrayPrototypePush(this.#todo, data);
    }
    return this;
  }

  /**
   * Clears the current line the cursor is on:
   *   -1 for left of the cursor
   *   +1 for right of the cursor
   *    0 for the entire line
   */
  clearLine(dir) {
    validateInteger(dir, 'dir', -1, 1);

    const data =
      dir < 0 ? kClearToLineBeginning :
        dir > 0 ? kClearToLineEnd :
          kClearLine;
    if (this.#autoCommit) process.nextTick(() => this.#stream.write(data));
    else ArrayPrototypePush(this.#todo, data);
    return this;
  }

  /**
   * Clears the screen from the current position of the cursor down.
   */
  clearScreenDown() {
    if (this.#autoCommit) {
      process.nextTick(() => this.#stream.write(kClearScreenDown));
    } else {
      ArrayPrototypePush(this.#todo, kClearScreenDown);
    }
    return this;
  }

  commit() {
    return new Promise((resolve) => {
      this.#stream.write(ArrayPrototypeJoin(this.#todo, ''), resolve);
      this.#todo = [];
    });
  }
  rollback() {
    this.#todo = [];
    return PromiseResolve();
  }
}

module.exports = {
  Readline,
};
