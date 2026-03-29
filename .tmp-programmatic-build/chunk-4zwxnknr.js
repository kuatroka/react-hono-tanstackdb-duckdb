var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined")
    return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// node_modules/@rocicorp/zero/out/shared/src/asserts.js
function assert(b, msg) {
  if (!b)
    throw new Error(typeof msg === "string" ? msg : msg());
}
function assertString(v) {
  assertType(v, "string");
}
function assertNumber(v) {
  assertType(v, "number");
}
function assertBoolean(v) {
  assertType(v, "boolean");
}
function assertType(v, t) {
  if (typeof v !== t)
    throwInvalidType(v, t);
}
function assertObject(v) {
  if (v === null)
    throwInvalidType(v, "object");
  assertType(v, "object");
}
function assertArray(v) {
  if (!Array.isArray(v))
    throwInvalidType(v, "array");
}
function invalidType(v, t) {
  let s = "Invalid type: ";
  if (v === null || v === undefined)
    s += v;
  else
    s += `${typeof v} \`${v}\``;
  return s + `, expected ${t}`;
}
function throwInvalidType(v, t) {
  throw new Error(invalidType(v, t));
}
function assertNotNull(v) {
  if (v === null)
    throw new Error("Expected non-null value");
}
function unreachable(_) {
  throw new Error("Unreachable");
}

// node_modules/@rocicorp/zero/out/_virtual/_rolldown/runtime.js
var __defProp2 = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames2 = Object.getOwnPropertyNames;
var __hasOwnProp2 = Object.prototype.hasOwnProperty;
var __exportAll = (all, no_symbols) => {
  let target = {};
  for (var name in all)
    __defProp2(target, name, {
      get: all[name],
      enumerable: true
    });
  if (!no_symbols)
    __defProp2(target, Symbol.toStringTag, { value: "Module" });
  return target;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function")
    for (var keys = __getOwnPropNames2(from), i = 0, n = keys.length, key;i < n; i++) {
      key = keys[i];
      if (!__hasOwnProp2.call(to, key) && key !== except)
        __defProp2(to, key, {
          get: ((k) => from[k]).bind(null, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
    }
  return to;
};
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));

// node_modules/@badrap/valita/dist/mjs/index.mjs
var exports_mjs = {};
__export(exports_mjs, {
  unknown: () => unknown,
  union: () => union,
  undefined: () => undefined_,
  tuple: () => tuple,
  string: () => string,
  record: () => record,
  ok: () => ok,
  object: () => object,
  number: () => number,
  null: () => null_,
  never: () => never,
  literal: () => literal,
  lazy: () => lazy,
  err: () => err,
  boolean: () => boolean,
  bigint: () => bigint,
  array: () => array,
  ValitaError: () => ValitaError
});
function joinIssues(left, right) {
  return left ? { ok: false, code: "join", left, right } : right;
}
function prependPath(key, tree) {
  return { ok: false, code: "prepend", key, tree };
}
function cloneIssueWithPath(tree, path) {
  const code = tree.code;
  switch (code) {
    case "invalid_type":
      return { code, path, expected: tree.expected };
    case "invalid_literal":
      return { code, path, expected: tree.expected };
    case "missing_value":
      return { code, path };
    case "invalid_length":
      return {
        code,
        path,
        minLength: tree.minLength,
        maxLength: tree.maxLength
      };
    case "unrecognized_keys":
      return { code, path, keys: tree.keys };
    case "invalid_union":
      return { code, path, tree: tree.tree };
    default:
      return { code, path, error: tree.error };
  }
}
function collectIssues(tree, path = [], issues = []) {
  for (;; ) {
    if (tree.code === "join") {
      collectIssues(tree.left, path.slice(), issues);
      tree = tree.right;
    } else if (tree.code === "prepend") {
      path.push(tree.key);
      tree = tree.tree;
    } else {
      if (tree.code === "custom_error" && typeof tree.error === "object" && tree.error.path !== undefined) {
        path.push(...tree.error.path);
      }
      issues.push(cloneIssueWithPath(tree, path));
      return issues;
    }
  }
}
function separatedList(list, sep) {
  if (list.length === 0) {
    return "nothing";
  } else if (list.length === 1) {
    return list[0];
  } else {
    return `${list.slice(0, -1).join(", ")} ${sep} ${list[list.length - 1]}`;
  }
}
function formatLiteral(value) {
  return typeof value === "bigint" ? `${value}n` : JSON.stringify(value);
}
function countIssues(tree) {
  let count = 0;
  for (;; ) {
    if (tree.code === "join") {
      count += countIssues(tree.left);
      tree = tree.right;
    } else if (tree.code === "prepend") {
      tree = tree.tree;
    } else {
      return count + 1;
    }
  }
}
function formatIssueTree(tree) {
  let path = "";
  let count = 0;
  for (;; ) {
    if (tree.code === "join") {
      count += countIssues(tree.right);
      tree = tree.left;
    } else if (tree.code === "prepend") {
      path += "." + tree.key;
      tree = tree.tree;
    } else {
      break;
    }
  }
  let message = "validation failed";
  if (tree.code === "invalid_type") {
    message = `expected ${separatedList(tree.expected, "or")}`;
  } else if (tree.code === "invalid_literal") {
    message = `expected ${separatedList(tree.expected.map(formatLiteral), "or")}`;
  } else if (tree.code === "missing_value") {
    message = `missing value`;
  } else if (tree.code === "unrecognized_keys") {
    const keys = tree.keys;
    message = `unrecognized ${keys.length === 1 ? "key" : "keys"} ${separatedList(keys.map(formatLiteral), "and")}`;
  } else if (tree.code === "invalid_length") {
    const min = tree.minLength;
    const max = tree.maxLength;
    message = `expected an array with `;
    if (min > 0) {
      if (max === min) {
        message += `${min}`;
      } else if (max !== undefined) {
        message += `between ${min} and ${max}`;
      } else {
        message += `at least ${min}`;
      }
    } else {
      message += `at most ${max}`;
    }
    message += ` item(s)`;
  } else if (tree.code === "custom_error") {
    const error = tree.error;
    if (typeof error === "string") {
      message = error;
    } else if (error !== undefined) {
      if (error.message !== undefined) {
        message = error.message;
      }
      if (error.path !== undefined) {
        path += "." + error.path.join(".");
      }
    }
  }
  let msg = `${tree.code} at .${path.slice(1)} (${message})`;
  if (count === 1) {
    msg += ` (+ 1 other issue)`;
  } else if (count > 1) {
    msg += ` (+ ${count} other issues)`;
  }
  return msg;
}

class ValitaError extends Error {
  constructor(issueTree) {
    super(formatIssueTree(issueTree));
    this.issueTree = issueTree;
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = new.target.name;
    this._issues = undefined;
  }
  get issues() {
    if (this._issues === undefined) {
      this._issues = collectIssues(this.issueTree);
    }
    return this._issues;
  }
}

class ErrImpl {
  constructor(issueTree) {
    this.issueTree = issueTree;
    this.ok = false;
    this._issues = undefined;
    this._message = undefined;
  }
  get issues() {
    if (this._issues === undefined) {
      this._issues = collectIssues(this.issueTree);
    }
    return this._issues;
  }
  get message() {
    if (this._message === undefined) {
      this._message = formatIssueTree(this.issueTree);
    }
    return this._message;
  }
  throw() {
    throw new ValitaError(this.issueTree);
  }
}
function ok(value) {
  return { ok: true, value };
}
function err(error) {
  return new ErrImpl({ ok: false, code: "custom_error", error });
}
function isObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
var FLAG_FORBID_EXTRA_KEYS = 1;
var FLAG_STRIP_EXTRA_KEYS = 2;
var FLAG_MISSING_VALUE = 4;

class AbstractType {
  optional(defaultFn) {
    const optional = new Optional(this);
    if (!defaultFn) {
      return optional;
    }
    return new TransformType(optional, (v) => {
      return v === undefined ? { ok: true, value: defaultFn() } : undefined;
    });
  }
  default(defaultValue) {
    const defaultResult = ok(defaultValue);
    return new TransformType(this.optional(), (v) => {
      return v === undefined ? defaultResult : undefined;
    });
  }
  assert(func, error) {
    const err2 = { ok: false, code: "custom_error", error };
    return new TransformType(this, (v, options) => func(v, options) ? undefined : err2);
  }
  map(func) {
    return new TransformType(this, (v, options) => ({
      ok: true,
      value: func(v, options)
    }));
  }
  chain(func) {
    return new TransformType(this, (v, options) => {
      const r = func(v, options);
      return r.ok ? r : r.issueTree;
    });
  }
}

class Type extends AbstractType {
  nullable() {
    return new Nullable(this);
  }
  toTerminals(func) {
    func(this);
  }
  try(v, options) {
    let flags = FLAG_FORBID_EXTRA_KEYS;
    if ((options === null || options === undefined ? undefined : options.mode) === "passthrough") {
      flags = 0;
    } else if ((options === null || options === undefined ? undefined : options.mode) === "strip") {
      flags = FLAG_STRIP_EXTRA_KEYS;
    }
    const r = this.func(v, flags);
    if (r === undefined) {
      return { ok: true, value: v };
    } else if (r.ok) {
      return { ok: true, value: r.value };
    } else {
      return new ErrImpl(r);
    }
  }
  parse(v, options) {
    let flags = FLAG_FORBID_EXTRA_KEYS;
    if ((options === null || options === undefined ? undefined : options.mode) === "passthrough") {
      flags = 0;
    } else if ((options === null || options === undefined ? undefined : options.mode) === "strip") {
      flags = FLAG_STRIP_EXTRA_KEYS;
    }
    const r = this.func(v, flags);
    if (r === undefined) {
      return v;
    } else if (r.ok) {
      return r.value;
    } else {
      throw new ValitaError(r);
    }
  }
}

class Nullable extends Type {
  constructor(type) {
    super();
    this.type = type;
    this.name = "nullable";
  }
  func(v, flags) {
    return v === null ? undefined : this.type.func(v, flags);
  }
  toTerminals(func) {
    func(nullSingleton);
    this.type.toTerminals(func);
  }
  nullable() {
    return this;
  }
}

class Optional extends AbstractType {
  constructor(type) {
    super();
    this.type = type;
    this.name = "optional";
  }
  func(v, flags) {
    return v === undefined || flags & FLAG_MISSING_VALUE ? undefined : this.type.func(v, flags);
  }
  toTerminals(func) {
    func(this);
    func(undefinedSingleton);
    this.type.toTerminals(func);
  }
  optional(defaultFn) {
    if (!defaultFn) {
      return this;
    }
    return new TransformType(this, (v) => {
      return v === undefined ? { ok: true, value: defaultFn() } : undefined;
    });
  }
}
function setBit(bits, index) {
  if (typeof bits !== "number") {
    const idx = index >> 5;
    for (let i = bits.length;i <= idx; i++) {
      bits.push(0);
    }
    bits[idx] |= 1 << index % 32;
    return bits;
  } else if (index < 32) {
    return bits | 1 << index;
  } else {
    return setBit([bits, 0], index);
  }
}
function getBit(bits, index) {
  if (typeof bits === "number") {
    return index < 32 ? bits >>> index & 1 : 0;
  } else {
    return bits[index >> 5] >>> index % 32 & 1;
  }
}

class ObjectType extends Type {
  constructor(shape, restType, checks) {
    super();
    this.shape = shape;
    this.restType = restType;
    this.checks = checks;
    this.name = "object";
    this._invalidType = {
      ok: false,
      code: "invalid_type",
      expected: ["object"]
    };
  }
  check(func, error) {
    var _a;
    const issue = { ok: false, code: "custom_error", error };
    return new ObjectType(this.shape, this.restType, [
      ...(_a = this.checks) !== null && _a !== undefined ? _a : [],
      {
        func,
        issue
      }
    ]);
  }
  func(v, flags) {
    if (!isObject(v)) {
      return this._invalidType;
    }
    let func = this._func;
    if (func === undefined) {
      func = createObjectMatcher(this.shape, this.restType, this.checks);
      this._func = func;
    }
    return func(v, flags);
  }
  rest(restType) {
    return new ObjectType(this.shape, restType);
  }
  extend(shape) {
    return new ObjectType(Object.assign(Object.assign({}, this.shape), shape), this.restType);
  }
  pick(...keys) {
    const shape = {};
    keys.forEach((key) => {
      shape[key] = this.shape[key];
    });
    return new ObjectType(shape, undefined);
  }
  omit(...keys) {
    const shape = Object.assign({}, this.shape);
    keys.forEach((key) => {
      delete shape[key];
    });
    return new ObjectType(shape, this.restType);
  }
  partial() {
    var _a;
    const shape = {};
    Object.keys(this.shape).forEach((key) => {
      shape[key] = this.shape[key].optional();
    });
    const rest = (_a = this.restType) === null || _a === undefined ? undefined : _a.optional();
    return new ObjectType(shape, rest);
  }
}
function createObjectMatcher(shape, rest, checks) {
  const requiredKeys = [];
  const optionalKeys = [];
  for (const key in shape) {
    let hasOptional = false;
    shape[key].toTerminals((t) => {
      hasOptional || (hasOptional = t.name === "optional");
    });
    if (hasOptional) {
      optionalKeys.push(key);
    } else {
      requiredKeys.push(key);
    }
  }
  const keys = [...requiredKeys, ...optionalKeys];
  const totalCount = keys.length;
  if (totalCount === 0 && (rest === null || rest === undefined ? undefined : rest.name) === "unknown") {
    return function(obj, _) {
      if (checks !== undefined) {
        for (let i = 0;i < checks.length; i++) {
          if (!checks[i].func(obj)) {
            return checks[i].issue;
          }
        }
      }
      return;
    };
  }
  const types = keys.map((key) => shape[key]);
  const requiredCount = requiredKeys.length;
  const invertedIndexes = Object.create(null);
  keys.forEach((key, index) => {
    invertedIndexes[key] = ~index;
  });
  const missingValues = requiredKeys.map((key) => prependPath(key, {
    ok: false,
    code: "missing_value"
  }));
  function set(obj, key, value) {
    if (key === "__proto__") {
      Object.defineProperty(obj, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true
      });
    } else {
      obj[key] = value;
    }
  }
  return function(obj, flags) {
    let copied = false;
    let output = obj;
    let issues;
    let unrecognized = undefined;
    let seenBits = 0;
    let seenCount = 0;
    if (flags & FLAG_FORBID_EXTRA_KEYS || flags & FLAG_STRIP_EXTRA_KEYS || rest !== undefined) {
      for (const key in obj) {
        const value = obj[key];
        const index = ~invertedIndexes[key];
        let r;
        if (index >= 0) {
          seenCount++;
          seenBits = setBit(seenBits, index);
          r = types[index].func(value, flags);
        } else if (rest !== undefined) {
          r = rest.func(value, flags);
        } else {
          if (flags & FLAG_FORBID_EXTRA_KEYS) {
            if (unrecognized === undefined) {
              unrecognized = [key];
            } else {
              unrecognized.push(key);
            }
          } else if (flags & FLAG_STRIP_EXTRA_KEYS && issues === undefined && !copied) {
            output = {};
            copied = true;
            for (let m = 0;m < totalCount; m++) {
              if (getBit(seenBits, m)) {
                const k = keys[m];
                set(output, k, obj[k]);
              }
            }
          }
          continue;
        }
        if (r === undefined) {
          if (copied && issues === undefined) {
            set(output, key, value);
          }
        } else if (!r.ok) {
          issues = joinIssues(issues, prependPath(key, r));
        } else if (issues === undefined) {
          if (!copied) {
            output = {};
            copied = true;
            if (rest === undefined) {
              for (let m = 0;m < totalCount; m++) {
                if (m !== index && getBit(seenBits, m)) {
                  const k = keys[m];
                  set(output, k, obj[k]);
                }
              }
            } else {
              for (const k in obj) {
                set(output, k, obj[k]);
              }
            }
          }
          set(output, key, r.value);
        }
      }
    }
    if (seenCount < totalCount) {
      for (let i = 0;i < totalCount; i++) {
        if (getBit(seenBits, i)) {
          continue;
        }
        const key = keys[i];
        const value = obj[key];
        let keyFlags = flags & ~FLAG_MISSING_VALUE;
        if (value === undefined && !(key in obj)) {
          if (i < requiredCount) {
            issues = joinIssues(issues, missingValues[i]);
            continue;
          }
          keyFlags |= FLAG_MISSING_VALUE;
        }
        const r = types[i].func(value, keyFlags);
        if (r === undefined) {
          if (copied && issues === undefined && !(keyFlags & FLAG_MISSING_VALUE)) {
            set(output, key, value);
          }
        } else if (!r.ok) {
          issues = joinIssues(issues, prependPath(key, r));
        } else if (issues === undefined) {
          if (!copied) {
            output = {};
            copied = true;
            if (rest === undefined) {
              for (let m = 0;m < totalCount; m++) {
                if (m < i || getBit(seenBits, m)) {
                  const k = keys[m];
                  set(output, k, obj[k]);
                }
              }
            } else {
              for (const k in obj) {
                set(output, k, obj[k]);
              }
              for (let m = 0;m < i; m++) {
                if (!getBit(seenBits, m)) {
                  const k = keys[m];
                  set(output, k, obj[k]);
                }
              }
            }
          }
          set(output, key, r.value);
        }
      }
    }
    if (unrecognized !== undefined) {
      issues = joinIssues(issues, {
        ok: false,
        code: "unrecognized_keys",
        keys: unrecognized
      });
    }
    if (issues === undefined && checks !== undefined) {
      for (let i = 0;i < checks.length; i++) {
        if (!checks[i].func(output)) {
          return checks[i].issue;
        }
      }
    }
    if (issues === undefined && copied) {
      return { ok: true, value: output };
    } else {
      return issues;
    }
  };
}

class ArrayOrTupleType extends Type {
  constructor(prefix, rest, suffix) {
    super();
    this.prefix = prefix;
    this.rest = rest;
    this.suffix = suffix;
    this.name = "array";
    this.restType = rest !== null && rest !== undefined ? rest : never();
    this.minLength = this.prefix.length + this.suffix.length;
    this.maxLength = rest ? undefined : this.minLength;
    this.invalidType = {
      ok: false,
      code: "invalid_type",
      expected: ["array"]
    };
    this.invalidLength = {
      ok: false,
      code: "invalid_length",
      minLength: this.minLength,
      maxLength: this.maxLength
    };
  }
  func(arr, flags) {
    var _a;
    if (!Array.isArray(arr)) {
      return this.invalidType;
    }
    const length = arr.length;
    const minLength = this.minLength;
    const maxLength = (_a = this.maxLength) !== null && _a !== undefined ? _a : Infinity;
    if (length < minLength || length > maxLength) {
      return this.invalidLength;
    }
    const headEnd = this.prefix.length;
    const tailStart = arr.length - this.suffix.length;
    let issueTree = undefined;
    let output = arr;
    for (let i = 0;i < arr.length; i++) {
      const type = i < headEnd ? this.prefix[i] : i >= tailStart ? this.suffix[i - tailStart] : this.restType;
      const r = type.func(arr[i], flags);
      if (r !== undefined) {
        if (r.ok) {
          if (output === arr) {
            output = arr.slice();
          }
          output[i] = r.value;
        } else {
          issueTree = joinIssues(issueTree, prependPath(i, r));
        }
      }
    }
    if (issueTree) {
      return issueTree;
    } else if (arr === output) {
      return;
    } else {
      return { ok: true, value: output };
    }
  }
  concat(type) {
    if (this.rest) {
      if (type.rest) {
        throw new TypeError("can not concatenate two variadic types");
      }
      return new ArrayOrTupleType(this.prefix, this.rest, [
        ...this.suffix,
        ...type.prefix,
        ...type.suffix
      ]);
    } else if (type.rest) {
      return new ArrayOrTupleType([...this.prefix, ...this.suffix, ...type.prefix], type.rest, type.suffix);
    } else {
      return new ArrayOrTupleType([...this.prefix, ...this.suffix, ...type.prefix, ...type.suffix], type.rest, type.suffix);
    }
  }
}
function toInputType(v) {
  const type = typeof v;
  if (type !== "object") {
    return type;
  } else if (v === null) {
    return "null";
  } else if (Array.isArray(v)) {
    return "array";
  } else {
    return type;
  }
}
function dedup(arr) {
  return Array.from(new Set(arr));
}
function findCommonKeys(rs) {
  const map = new Map;
  rs.forEach((r) => {
    for (const key in r) {
      map.set(key, (map.get(key) || 0) + 1);
    }
  });
  const result = [];
  map.forEach((count, key) => {
    if (count === rs.length) {
      result.push(key);
    }
  });
  return result;
}
function groupTerminals(terminals) {
  const order = new Map;
  const literals = new Map;
  const types = new Map;
  const unknowns = [];
  const optionals = [];
  const expectedTypes = [];
  terminals.forEach(({ root, terminal }) => {
    var _a;
    order.set(root, (_a = order.get(root)) !== null && _a !== undefined ? _a : order.size);
    if (terminal.name === "never") {} else if (terminal.name === "optional") {
      optionals.push(root);
    } else if (terminal.name === "unknown") {
      unknowns.push(root);
    } else if (terminal.name === "literal") {
      const roots = literals.get(terminal.value) || [];
      roots.push(root);
      literals.set(terminal.value, roots);
      expectedTypes.push(toInputType(terminal.value));
    } else {
      const roots = types.get(terminal.name) || [];
      roots.push(root);
      types.set(terminal.name, roots);
      expectedTypes.push(terminal.name);
    }
  });
  literals.forEach((roots, value) => {
    const options = types.get(toInputType(value));
    if (options) {
      options.push(...roots);
      literals.delete(value);
    }
  });
  const byOrder = (a, b) => {
    var _a, _b;
    return ((_a = order.get(a)) !== null && _a !== undefined ? _a : 0) - ((_b = order.get(b)) !== null && _b !== undefined ? _b : 0);
  };
  types.forEach((roots, type) => types.set(type, dedup(roots.concat(unknowns).sort(byOrder))));
  literals.forEach((roots, value) => literals.set(value, dedup(roots.concat(unknowns)).sort(byOrder)));
  return {
    types,
    literals,
    unknowns: dedup(unknowns).sort(byOrder),
    optionals: dedup(optionals).sort(byOrder),
    expectedTypes: dedup(expectedTypes)
  };
}
function createObjectKeyMatcher(objects, key) {
  const list = [];
  for (const { root, terminal } of objects) {
    terminal.shape[key].toTerminals((t) => list.push({ root, terminal: t }));
  }
  const { types, literals, optionals, unknowns, expectedTypes } = groupTerminals(list);
  if (unknowns.length > 0 || optionals.length > 1) {
    return;
  }
  for (const roots of literals.values()) {
    if (roots.length > 1) {
      return;
    }
  }
  for (const roots of types.values()) {
    if (roots.length > 1) {
      return;
    }
  }
  const missingValue = prependPath(key, { ok: false, code: "missing_value" });
  const issue = prependPath(key, types.size === 0 ? {
    ok: false,
    code: "invalid_literal",
    expected: Array.from(literals.keys())
  } : {
    ok: false,
    code: "invalid_type",
    expected: expectedTypes
  });
  const litMap = literals.size > 0 ? new Map : undefined;
  for (const [literal, options] of literals) {
    litMap.set(literal, options[0]);
  }
  const byType = types.size > 0 ? {} : undefined;
  for (const [type, options] of types) {
    byType[type] = options[0];
  }
  return function(_obj, flags) {
    var _a;
    const obj = _obj;
    const value = obj[key];
    if (value === undefined && !(key in obj)) {
      return optionals.length > 0 ? optionals[0].func(obj, flags) : missingValue;
    }
    const option = (_a = byType === null || byType === undefined ? undefined : byType[toInputType(value)]) !== null && _a !== undefined ? _a : litMap === null || litMap === undefined ? undefined : litMap.get(value);
    return option ? option.func(obj, flags) : issue;
  };
}
function createUnionObjectMatcher(terminals) {
  if (terminals.some(({ terminal: t }) => t.name === "unknown")) {
    return;
  }
  const objects = terminals.filter((item) => {
    return item.terminal.name === "object";
  });
  if (objects.length < 2) {
    return;
  }
  const shapes = objects.map(({ terminal }) => terminal.shape);
  for (const key of findCommonKeys(shapes)) {
    const matcher = createObjectKeyMatcher(objects, key);
    if (matcher) {
      return matcher;
    }
  }
  return;
}
function createUnionBaseMatcher(terminals) {
  const { expectedTypes, literals, types, unknowns, optionals } = groupTerminals(terminals);
  const issue = types.size === 0 && unknowns.length === 0 ? {
    ok: false,
    code: "invalid_literal",
    expected: Array.from(literals.keys())
  } : {
    ok: false,
    code: "invalid_type",
    expected: expectedTypes
  };
  const litMap = literals.size > 0 ? literals : undefined;
  const byType = types.size > 0 ? {} : undefined;
  for (const [type, options] of types) {
    byType[type] = options;
  }
  return function(value, flags) {
    var _a, _b;
    let options;
    if (flags & FLAG_MISSING_VALUE) {
      options = optionals;
    } else {
      options = (_b = (_a = byType === null || byType === undefined ? undefined : byType[toInputType(value)]) !== null && _a !== undefined ? _a : litMap === null || litMap === undefined ? undefined : litMap.get(value)) !== null && _b !== undefined ? _b : unknowns;
    }
    if (!options) {
      return issue;
    }
    let count = 0;
    let issueTree = issue;
    for (let i = 0;i < options.length; i++) {
      const r = options[i].func(value, flags);
      if (r === undefined || r.ok) {
        return r;
      }
      issueTree = count > 0 ? joinIssues(issueTree, r) : r;
      count++;
    }
    if (count > 1) {
      return { ok: false, code: "invalid_union", tree: issueTree };
    }
    return issueTree;
  };
}

class UnionType extends Type {
  constructor(options) {
    super();
    this.options = options;
    this.name = "union";
  }
  toTerminals(func) {
    this.options.forEach((o) => o.toTerminals(func));
  }
  func(v, flags) {
    let func = this._func;
    if (func === undefined) {
      const flattened = [];
      this.options.forEach((option) => option.toTerminals((terminal) => {
        flattened.push({ root: option, terminal });
      }));
      const base = createUnionBaseMatcher(flattened);
      const object = createUnionObjectMatcher(flattened);
      if (!object) {
        func = base;
      } else {
        func = function(v2, f) {
          if (isObject(v2)) {
            return object(v2, f);
          }
          return base(v2, f);
        };
      }
      this._func = func;
    }
    return func(v, flags);
  }
}
var STRICT = Object.freeze({ mode: "strict" });
var STRIP = Object.freeze({ mode: "strip" });
var PASSTHROUGH = Object.freeze({ mode: "passthrough" });

class TransformType extends Type {
  constructor(transformed, transform) {
    super();
    this.transformed = transformed;
    this.transform = transform;
    this.name = "transform";
    this.undef = ok(undefined);
    this.transformChain = undefined;
    this.transformRoot = undefined;
  }
  func(v, flags) {
    let chain = this.transformChain;
    if (!chain) {
      chain = [];
      let next = this;
      while (next instanceof TransformType) {
        chain.push(next.transform);
        next = next.transformed;
      }
      chain.reverse();
      this.transformChain = chain;
      this.transformRoot = next;
    }
    let result = this.transformRoot.func(v, flags);
    if (result !== undefined && !result.ok) {
      return result;
    }
    let current;
    if (result !== undefined) {
      current = result.value;
    } else if (flags & FLAG_MISSING_VALUE) {
      current = undefined;
      result = this.undef;
    } else {
      current = v;
    }
    const options = flags & FLAG_FORBID_EXTRA_KEYS ? STRICT : flags & FLAG_STRIP_EXTRA_KEYS ? STRIP : PASSTHROUGH;
    for (let i = 0;i < chain.length; i++) {
      const r = chain[i](current, options);
      if (r !== undefined) {
        if (!r.ok) {
          return r;
        }
        current = r.value;
        result = r;
      }
    }
    return result;
  }
  toTerminals(func) {
    this.transformed.toTerminals(func);
  }
}

class LazyType extends Type {
  constructor(definer) {
    super();
    this.definer = definer;
    this.name = "lazy";
    this.recursing = false;
  }
  func(v, flags) {
    if (!this.type) {
      this.type = this.definer();
    }
    return this.type.func(v, flags);
  }
  toTerminals(func) {
    if (this.recursing) {
      return;
    }
    try {
      this.recursing = true;
      if (!this.type) {
        this.type = this.definer();
      }
      this.type.toTerminals(func);
    } finally {
      this.recursing = false;
    }
  }
}

class NeverType extends Type {
  constructor() {
    super(...arguments);
    this.name = "never";
    this.issue = {
      ok: false,
      code: "invalid_type",
      expected: []
    };
  }
  func(_, __) {
    return this.issue;
  }
}
var neverSingleton = new NeverType;
function never() {
  return neverSingleton;
}

class UnknownType extends Type {
  constructor() {
    super(...arguments);
    this.name = "unknown";
  }
  func(_, __) {
    return;
  }
}
var unknownSingleton = new UnknownType;
function unknown() {
  return unknownSingleton;
}

class UndefinedType extends Type {
  constructor() {
    super(...arguments);
    this.name = "undefined";
    this.issue = {
      ok: false,
      code: "invalid_type",
      expected: ["undefined"]
    };
  }
  func(v, _) {
    return v === undefined ? undefined : this.issue;
  }
}
var undefinedSingleton = new UndefinedType;
function undefined_() {
  return undefinedSingleton;
}

class NullType extends Type {
  constructor() {
    super(...arguments);
    this.name = "null";
    this.issue = {
      ok: false,
      code: "invalid_type",
      expected: ["null"]
    };
  }
  func(v, _) {
    return v === null ? undefined : this.issue;
  }
}
var nullSingleton = new NullType;
function null_() {
  return nullSingleton;
}

class NumberType extends Type {
  constructor() {
    super(...arguments);
    this.name = "number";
    this.issue = {
      ok: false,
      code: "invalid_type",
      expected: ["number"]
    };
  }
  func(v, _) {
    return typeof v === "number" ? undefined : this.issue;
  }
}
var numberSingleton = new NumberType;
function number() {
  return numberSingleton;
}

class BigIntType extends Type {
  constructor() {
    super(...arguments);
    this.name = "bigint";
    this.issue = {
      ok: false,
      code: "invalid_type",
      expected: ["bigint"]
    };
  }
  func(v, _) {
    return typeof v === "bigint" ? undefined : this.issue;
  }
}
var bigintSingleton = new BigIntType;
function bigint() {
  return bigintSingleton;
}

class StringType extends Type {
  constructor() {
    super(...arguments);
    this.name = "string";
    this.issue = {
      ok: false,
      code: "invalid_type",
      expected: ["string"]
    };
  }
  func(v, _) {
    return typeof v === "string" ? undefined : this.issue;
  }
}
var stringSingleton = new StringType;
function string() {
  return stringSingleton;
}

class BooleanType extends Type {
  constructor() {
    super(...arguments);
    this.name = "boolean";
    this.issue = {
      ok: false,
      code: "invalid_type",
      expected: ["boolean"]
    };
  }
  func(v, _) {
    return typeof v === "boolean" ? undefined : this.issue;
  }
}
var booleanSingleton = new BooleanType;
function boolean() {
  return booleanSingleton;
}

class LiteralType extends Type {
  constructor(value) {
    super();
    this.value = value;
    this.name = "literal";
    this.issue = {
      ok: false,
      code: "invalid_literal",
      expected: [value]
    };
  }
  func(v, _) {
    return v === this.value ? undefined : this.issue;
  }
}
function literal(value) {
  return new LiteralType(value);
}
function object(obj) {
  return new ObjectType(obj, undefined);
}
function record(valueType) {
  return new ObjectType({}, valueType !== null && valueType !== undefined ? valueType : unknown());
}
function array(item) {
  return new ArrayOrTupleType([], item !== null && item !== undefined ? item : unknown(), []);
}
function tuple(items) {
  return new ArrayOrTupleType(items, undefined, []);
}
function union(...options) {
  return new UnionType(options);
}
function lazy(definer) {
  return new LazyType(definer);
}
// node_modules/@rocicorp/zero/out/shared/src/valita.js
var valita_exports = /* @__PURE__ */ __exportAll({
  assert: () => assert2,
  deepPartial: () => deepPartial,
  instanceOfAbstractType: () => instanceOfAbstractType,
  is: () => is,
  literalUnion: () => literalUnion,
  parse: () => parse,
  readonly: () => readonly,
  readonlyArray: () => readonlyArray,
  readonlyObject: () => readonlyObject,
  readonlyRecord: () => readonlyRecord,
  test: () => test,
  testOptional: () => testOptional
});
__reExport(valita_exports, exports_mjs);
function toDisplay(value) {
  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      return JSON.stringify(value);
    case "undefined":
      return "undefined";
    case "bigint":
      return value.toString() + "n";
    default:
      if (value === null)
        return "null";
      if (Array.isArray(value))
        return "array";
      return typeof value;
  }
}
function toDisplayAtPath(v, path) {
  if (!path?.length)
    return toDisplay(v);
  let cur = v;
  for (const p of path)
    cur = cur[p];
  return toDisplay(cur);
}
function displayList(word, expected, toDisplay2 = (x) => String(x)) {
  if (expected.length === 1)
    return toDisplay2(expected[0]);
  const suffix = `${toDisplay2(expected[expected.length - 2])} ${word} ${toDisplay2(expected[expected.length - 1])}`;
  if (expected.length === 2)
    return suffix;
  return `${expected.slice(0, -2).map(toDisplay2).join(", ")}, ${suffix}`;
}
function getMessage(err2, v, schema, mode) {
  const firstIssue = err2.issues[0];
  const { path } = firstIssue;
  const atPath = path?.length ? ` at ${path.join(".")}` : "";
  switch (firstIssue.code) {
    case "invalid_type":
      return `Expected ${displayList("or", firstIssue.expected)}${atPath}. Got ${toDisplayAtPath(v, path)}`;
    case "missing_value": {
      const atPath2 = path && path.length > 1 ? ` at ${path.slice(0, -1).join(".")}` : "";
      if (firstIssue.path?.length)
        return `Missing property ${firstIssue.path.at(-1)}${atPath2}`;
      return `TODO Unknown missing property${atPath2}`;
    }
    case "invalid_literal":
      return `Expected literal value ${displayList("or", firstIssue.expected, toDisplay)}${atPath} Got ${toDisplayAtPath(v, path)}`;
    case "invalid_length":
      return `Expected array with length ${firstIssue.minLength === firstIssue.maxLength ? firstIssue.minLength : `between ${firstIssue.minLength} and ${firstIssue.maxLength}`}${atPath}. Got array with length ${v.length}`;
    case "unrecognized_keys":
      if (firstIssue.keys.length === 1)
        return `Unexpected property ${firstIssue.keys[0]}${atPath}`;
      return `Unexpected properties ${displayList("and", firstIssue.keys)}${atPath}`;
    case "invalid_union":
      return schema.name === "union" ? getDeepestUnionParseError(v, schema, mode ?? "strict") : `Invalid union value${atPath}`;
    case "custom_error": {
      const { error } = firstIssue;
      return `${!error ? "unknown" : typeof error === "string" ? error : error.message ?? "unknown"}${atPath}. Got ${toDisplayAtPath(v, path)}`;
    }
  }
}
function getDeepestUnionParseError(value, schema, mode) {
  const failures = [];
  for (const type of schema.options) {
    const r = type.try(value, { mode });
    if (!r.ok)
      failures.push({
        type,
        err: r
      });
  }
  if (failures.length) {
    failures.sort(pathCmp);
    if (failures.length === 1 || pathCmp(failures[0], failures[1]) < 0)
      return getMessage(failures[0].err, value, failures[0].type, mode);
  }
  try {
    return `Invalid union value: ${JSON.stringify(value)}`;
  } catch {
    return `Invalid union value`;
  }
}
function pathCmp(a, b) {
  const aPath = a.err.issues[0].path;
  const bPath = b.err.issues[0].path;
  if (aPath.length !== bPath.length)
    return bPath.length - aPath.length;
  for (let i = 0;i < aPath.length; i++) {
    if (bPath[i] > aPath[i])
      return -1;
    if (bPath[i] < aPath[i])
      return 1;
  }
  return 0;
}
function parse(value, schema, mode) {
  const res = test(value, schema, mode);
  if (!res.ok)
    throw new TypeError(res.error);
  return res.value;
}
function is(value, schema, mode) {
  return test(value, schema, mode).ok;
}
function assert2(value, schema, mode) {
  parse(value, schema, mode);
}
function test(value, schema, mode) {
  const res = schema.try(value, mode ? { mode } : undefined);
  if (!res.ok)
    return {
      ok: false,
      error: getMessage(res, value, schema, mode)
    };
  return res;
}
function testOptional(value, schema, mode) {
  let flags = 1;
  if (mode === "passthrough")
    flags = 0;
  else if (mode === "strip")
    flags = 2;
  const res = schema.func(value, flags);
  if (res === undefined)
    return {
      ok: true,
      value
    };
  else if (res.ok)
    return res;
  return {
    ok: false,
    error: getMessage(new ValitaError(res), value, schema, mode)
  };
}
function readonly(t) {
  return t;
}
function readonlyObject(t) {
  return object(t);
}
function readonlyArray(t) {
  return array(t);
}
function readonlyRecord(t) {
  return record(t);
}
var AbstractType2 = Object.getPrototypeOf(Object.getPrototypeOf(string().optional())).constructor;
function instanceOfAbstractType(obj) {
  return obj instanceof AbstractType2;
}
function deepPartial(s) {
  const shape = {};
  for (const [key, type] of Object.entries(s.shape))
    if (type.name === "object")
      shape[key] = deepPartial(type).optional();
    else
      shape[key] = type.optional();
  return object(shape);
}
function literalUnion(...literals) {
  return union(...literals.map(literal));
}

// node_modules/@rocicorp/zero/out/shared/src/config.js
var isProd = false;

// node_modules/@rocicorp/zero/out/shared/src/has-own.js
var { hasOwn } = Object;

// node_modules/@rocicorp/zero/out/shared/src/json.js
function deepEqual(a, b) {
  if (a === b)
    return true;
  if (typeof a !== typeof b)
    return false;
  switch (typeof a) {
    case "boolean":
    case "number":
    case "string":
      return false;
  }
  a = a;
  if (Array.isArray(a)) {
    if (!Array.isArray(b))
      return false;
    if (a.length !== b.length)
      return false;
    for (let i = 0;i < a.length; i++)
      if (!deepEqual(a[i], b[i]))
        return false;
    return true;
  }
  if (a === null || b === null)
    return false;
  if (Array.isArray(b))
    return false;
  a = a;
  b = b;
  let aSize = 0;
  for (const key in a)
    if (hasOwn(a, key)) {
      if (!deepEqual(a[key], b[key]))
        return false;
      aSize++;
    }
  let bSize = 0;
  for (const key in b)
    if (hasOwn(b, key))
      bSize++;
  return aSize === bSize;
}
function assertJSONValue(v) {
  if (isProd)
    return;
  switch (typeof v) {
    case "boolean":
    case "number":
    case "string":
      return;
    case "object":
      if (v === null)
        return;
      if (Array.isArray(v))
        return assertJSONArray(v);
      return assertObjectIsJSONObject(v);
  }
  throwInvalidType(v, "JSON value");
}
function assertJSONObject(v) {
  assertObject(v);
  assertObjectIsJSONObject(v);
}
function assertObjectIsJSONObject(v) {
  for (const k in v)
    if (hasOwn(v, k)) {
      const value = v[k];
      if (value !== undefined)
        assertJSONValue(value);
    }
}
function assertJSONArray(v) {
  for (const item of v)
    assertJSONValue(item);
}
function isJSONValue(v, path) {
  switch (typeof v) {
    case "boolean":
    case "number":
    case "string":
      return true;
    case "object":
      if (v === null)
        return true;
      if (Array.isArray(v))
        return isJSONArray(v, path);
      return objectIsJSONObject(v, path);
  }
  return false;
}
function isJSONObject(v, path) {
  if (typeof v !== "object" || v === null)
    return false;
  return objectIsJSONObject(v, path);
}
function objectIsJSONObject(v, path) {
  for (const k in v)
    if (hasOwn(v, k)) {
      path.push(k);
      const value = v[k];
      if (value !== undefined && !isJSONValue(value, path))
        return false;
      path.pop();
    }
  return true;
}
function isJSONArray(v, path) {
  for (let i = 0;i < v.length; i++) {
    path.push(i);
    if (!isJSONValue(v[i], path))
      return false;
    path.pop();
  }
  return true;
}

// node_modules/@rocicorp/zero/out/shared/src/random-uint64.js
function randomUint64() {
  const high = Math.floor(Math.random() * 4294967295);
  const low = Math.floor(Math.random() * 4294967295);
  return BigInt(high) << 32n | BigInt(low);
}

// node_modules/@rocicorp/zero/out/replicache/src/hash.js
var hashRe = /^[0-9a-v-]+$/;
var emptyHash = "0".repeat(22);
var newRandomHash = makeNewRandomHashFunctionInternal();
function toStringAndSlice(n, len) {
  return n.toString(32).slice(-len).padStart(len, "0");
}
function makeNewRandomHashFunctionInternal() {
  let base = "";
  let i = 0;
  return () => {
    if (!base)
      base = toStringAndSlice(randomUint64(), 12);
    const tail = toStringAndSlice(i++, 10);
    return base + tail;
  };
}
function isHash(value) {
  return typeof value === "string" && hashRe.test(value);
}
function assertHash(value) {
  assert2(value, hashSchema);
}
var hashSchema = valita_exports.string().assert(isHash, "Invalid hash");

// node_modules/@rocicorp/zero/out/replicache/src/frozen-json.js
var deepFrozenObjects = /* @__PURE__ */ new WeakSet;
function deepFreeze(v) {
  if (isProd)
    return v;
  deepFreezeInternal(v, []);
  return v;
}
function deepFreezeInternal(v, seen) {
  switch (typeof v) {
    case "undefined":
      throw new TypeError("Unexpected value undefined");
    case "boolean":
    case "number":
    case "string":
      return;
    case "object":
      if (v === null)
        return;
      if (deepFrozenObjects.has(v))
        return;
      deepFrozenObjects.add(v);
      if (seen.includes(v))
        throwInvalidType(v, "Cyclic JSON object");
      seen.push(v);
      Object.freeze(v);
      if (Array.isArray(v))
        deepFreezeArray(v, seen);
      else
        deepFreezeObject(v, seen);
      seen.pop();
      return;
    default:
      throwInvalidType(v, "JSON value");
  }
}
function deepFreezeArray(v, seen) {
  for (const item of v)
    deepFreezeInternal(item, seen);
}
function deepFreezeObject(v, seen) {
  for (const k in v)
    if (hasOwn(v, k)) {
      const value = v[k];
      if (value !== undefined)
        deepFreezeInternal(value, seen);
    }
}
function assertDeepFrozen(v) {
  if (isProd)
    return;
  if (!isDeepFrozen(v, []))
    throw new Error("Expected frozen object");
}
function isDeepFrozen(v, seen) {
  switch (typeof v) {
    case "boolean":
    case "number":
    case "string":
      return true;
    case "object":
      if (v === null)
        return true;
      if (deepFrozenObjects.has(v))
        return true;
      if (!Object.isFrozen(v))
        return false;
      if (seen.includes(v))
        throwInvalidType(v, "Cyclic JSON object");
      seen.push(v);
      if (Array.isArray(v)) {
        for (const item of v)
          if (!isDeepFrozen(item, seen)) {
            seen.pop();
            return false;
          }
      } else
        for (const k in v)
          if (hasOwn(v, k)) {
            const value = v[k];
            if (value !== undefined && !isDeepFrozen(value, seen)) {
              seen.pop();
              return false;
            }
          }
      deepFrozenObjects.add(v);
      seen.pop();
      return true;
    default:
      throwInvalidType(v, "JSON value");
  }
}
function deepFreezeAllowUndefined(v) {
  if (v === undefined)
    return;
  return deepFreeze(v);
}

// node_modules/@rocicorp/zero/out/shared/src/binary-search.js
function binarySearch(high, compare) {
  let low = 0;
  while (low < high) {
    const mid = low + (high - low >> 1);
    const i = compare(mid);
    if (i === 0)
      return mid;
    if (i > 0)
      low = mid + 1;
    else
      high = mid;
  }
  return low;
}

// node_modules/@rocicorp/zero/out/shared/src/iterables.js
function* joinIterables(...iters) {
  for (const iter of iters)
    yield* iter;
}
function* filterIter(iter, p) {
  let index = 0;
  for (const t of iter)
    if (p(t, index++))
      yield t;
}
function* mapIter(iter, f) {
  let index = 0;
  for (const t of iter)
    yield f(t, index++);
}
function* once(stream) {
  const it = stream[Symbol.iterator]();
  const { value } = it.next();
  if (value !== undefined)
    yield value;
  it.return?.();
}
var iteratorFrom = globalThis.Iterator?.from ?? ((e) => new IterWrapper(e));
var IterWrapper = class IterWrapper2 {
  #iterator;
  constructor(iterable) {
    this.#iterator = iterable[Symbol.iterator]();
  }
  next() {
    return this.#iterator.next();
  }
  [Symbol.iterator]() {
    return this;
  }
  map(f) {
    return new IterWrapper2(mapIter(this, f));
  }
  filter(p) {
    return new IterWrapper2(filterIter(this, p));
  }
};
function wrapIterable(iter) {
  return iteratorFrom(iter);
}

// node_modules/compare-utf8/src/index.js
function compareUTF8(a, b) {
  const aLength = a.length;
  const bLength = b.length;
  const length = Math.min(aLength, bLength);
  for (let i = 0;i < length; ) {
    const aCodePoint = a.codePointAt(i);
    const bCodePoint = b.codePointAt(i);
    if (aCodePoint !== bCodePoint) {
      if (aCodePoint < 128 && bCodePoint < 128) {
        return aCodePoint - bCodePoint;
      }
      const aLength2 = utf8Bytes(aCodePoint, aBytes);
      const bLength2 = utf8Bytes(bCodePoint, bBytes);
      return compareArrays(aBytes, aLength2, bBytes, bLength2);
    }
    i += utf16LengthForCodePoint(aCodePoint);
  }
  return aLength - bLength;
}
function compareArrays(a, aLength, b, bLength) {
  const length = Math.min(aLength, bLength);
  for (let i = 0;i < length; i++) {
    const aValue = a[i];
    const bValue = b[i];
    if (aValue !== bValue) {
      return aValue - bValue;
    }
  }
  return aLength - bLength;
}
function utf16LengthForCodePoint(aCodePoint) {
  return aCodePoint > 65535 ? 2 : 1;
}
var arr = () => Array.from({ length: 4 }, () => 0);
var aBytes = arr();
var bBytes = arr();
function utf8Bytes(codePoint, bytes) {
  if (codePoint < 128) {
    bytes[0] = codePoint;
    return 1;
  }
  let count;
  let offset;
  if (codePoint <= 2047) {
    count = 1;
    offset = 192;
  } else if (codePoint <= 65535) {
    count = 2;
    offset = 224;
  } else if (codePoint <= 1114111) {
    count = 3;
    offset = 240;
  } else {
    throw new Error("Invalid code point");
  }
  bytes[0] = (codePoint >> 6 * count) + offset;
  let i = 1;
  for (;count > 0; count--) {
    const temp = codePoint >> 6 * (count - 1);
    bytes[i++] = 128 | temp & 63;
  }
  return i;
}
function greaterThan(a, b) {
  return compareUTF8(a, b) > 0;
}
function lessThan(a, b) {
  return compareUTF8(a, b) < 0;
}
function lessThanEq(a, b) {
  return compareUTF8(a, b) <= 0;
}

// node_modules/@rocicorp/zero/out/replicache/src/btree/node.js
function makeNodeChunkData(level, entries, formatVersion) {
  return deepFreeze([level, formatVersion >= 7 ? entries : entries.map((e) => e.slice(0, 2))]);
}
async function findLeaf(key, hash, source, expectedRootHash) {
  const node = await source.getNode(hash);
  if (expectedRootHash !== source.rootHash)
    return findLeaf(key, source.rootHash, source, source.rootHash);
  if (isDataNodeImpl(node))
    return node;
  const { entries } = node;
  let i = binarySearch2(key, entries);
  if (i === entries.length)
    i--;
  const entry = entries[i];
  return findLeaf(key, entry[1], source, expectedRootHash);
}
function binarySearch2(key, entries) {
  return binarySearch(entries.length, (i) => compareUTF8(key, entries[i][0]));
}
function binarySearchFound(i, entries, key) {
  return i !== entries.length && entries[i][0] === key;
}
function parseBTreeNode(v, formatVersion, getSizeOfEntry) {
  if (isProd && formatVersion >= 7)
    return v;
  assertArray(v);
  assertDeepFrozen(v);
  assert(v.length >= 2, "Expected node array to have at least 2 elements");
  const [level, entries] = v;
  assertNumber(level);
  assertArray(entries);
  const f = level > 0 ? assertString : assertJSONValue;
  if (formatVersion >= 7) {
    for (const e of entries)
      assertEntry(e, f);
    return v;
  }
  return [level, entries.map((e) => convertNonV7Entry(e, f, getSizeOfEntry))];
}
function assertEntry(entry, f) {
  assertArray(entry);
  assert(entry.length >= 3, "Expected entry array to have at least 3 elements");
  assertString(entry[0]);
  f(entry[1]);
  assertNumber(entry[2]);
}
function convertNonV7Entry(entry, f, getSizeOfEntry) {
  assertArray(entry);
  assert(entry.length >= 2, "Expected entry array to have at least 2 elements");
  assertString(entry[0]);
  f(entry[1]);
  const entrySize = getSizeOfEntry(entry[0], entry[1]);
  return [
    entry[0],
    entry[1],
    entrySize
  ];
}
var NodeImpl = class {
  entries;
  hash;
  isMutable;
  #childNodeSize = -1;
  constructor(entries, hash, isMutable) {
    this.entries = entries;
    this.hash = hash;
    this.isMutable = isMutable;
  }
  maxKey() {
    return this.entries[this.entries.length - 1][0];
  }
  getChildNodeSize(tree) {
    if (this.#childNodeSize !== -1)
      return this.#childNodeSize;
    let sum = tree.chunkHeaderSize;
    for (const entry of this.entries)
      sum += entry[2];
    return this.#childNodeSize = sum;
  }
  _updateNode(tree) {
    this.#childNodeSize = -1;
    tree.updateNode(this);
  }
};
function toChunkData(node, formatVersion) {
  return makeNodeChunkData(node.level, node.entries, formatVersion);
}
var DataNodeImpl = class extends NodeImpl {
  level = 0;
  set(key, value, entrySize, tree) {
    let deleteCount;
    const i = binarySearch2(key, this.entries);
    if (!binarySearchFound(i, this.entries, key))
      deleteCount = 0;
    else
      deleteCount = 1;
    return Promise.resolve(this.#splice(tree, i, deleteCount, [
      key,
      value,
      entrySize
    ]));
  }
  #splice(tree, start, deleteCount, ...items) {
    if (this.isMutable) {
      this.entries.splice(start, deleteCount, ...items);
      this._updateNode(tree);
      return this;
    }
    const entries = readonlySplice(this.entries, start, deleteCount, ...items);
    return tree.newDataNodeImpl(entries);
  }
  del(key, tree) {
    const i = binarySearch2(key, this.entries);
    if (!binarySearchFound(i, this.entries, key))
      return Promise.resolve(this);
    return Promise.resolve(this.#splice(tree, i, 1));
  }
  async* keys(_tree) {
    for (const entry of this.entries)
      yield entry[0];
  }
  async* entriesIter(_tree) {
    for (const entry of this.entries)
      yield entry;
  }
};
function readonlySplice(array2, start, deleteCount, ...items) {
  const arr2 = array2.slice(0, start);
  for (let i = 0;i < items.length; i++)
    arr2.push(items[i]);
  for (let i = start + deleteCount;i < array2.length; i++)
    arr2.push(array2[i]);
  return arr2;
}
var InternalNodeImpl = class InternalNodeImpl2 extends NodeImpl {
  level;
  constructor(entries, hash, level, isMutable) {
    super(entries, hash, isMutable);
    this.level = level;
  }
  async set(key, value, entrySize, tree) {
    let i = binarySearch2(key, this.entries);
    if (i === this.entries.length)
      i--;
    const childHash = this.entries[i][1];
    const childNode = await (await tree.getNode(childHash)).set(key, value, entrySize, tree);
    const childNodeSize = childNode.getChildNodeSize(tree);
    if (childNodeSize > tree.maxSize || childNodeSize < tree.minSize)
      return this.#mergeAndPartition(tree, i, childNode);
    const newEntry = createNewInternalEntryForNode(childNode, tree.getEntrySize);
    return this.#replaceChild(tree, i, newEntry);
  }
  async#mergeAndPartition(tree, i, childNode) {
    const level = this.level - 1;
    const thisEntries = this.entries;
    let values;
    let startIndex;
    let removeCount;
    if (i > 0) {
      const hash = thisEntries[i - 1][1];
      values = joinIterables((await tree.getNode(hash)).entries, childNode.entries);
      startIndex = i - 1;
      removeCount = 2;
    } else if (i < thisEntries.length - 1) {
      const hash = thisEntries[i + 1][1];
      const nextSibling = await tree.getNode(hash);
      values = joinIterables(childNode.entries, nextSibling.entries);
      startIndex = i;
      removeCount = 2;
    } else {
      values = childNode.entries;
      startIndex = i;
      removeCount = 1;
    }
    const partitions = partition(values, (value) => value[2], tree.minSize - tree.chunkHeaderSize, tree.maxSize - tree.chunkHeaderSize);
    const newEntries = [];
    for (const entries2 of partitions) {
      const newHashEntry = createNewInternalEntryForNode(tree.newNodeImpl(entries2, level), tree.getEntrySize);
      newEntries.push(newHashEntry);
    }
    if (this.isMutable) {
      this.entries.splice(startIndex, removeCount, ...newEntries);
      this._updateNode(tree);
      return this;
    }
    const entries = readonlySplice(thisEntries, startIndex, removeCount, ...newEntries);
    return tree.newInternalNodeImpl(entries, this.level);
  }
  #replaceChild(tree, index, newEntry) {
    if (this.isMutable) {
      this.entries.splice(index, 1, newEntry);
      this._updateNode(tree);
      return this;
    }
    const entries = readonlySplice(this.entries, index, 1, newEntry);
    return tree.newInternalNodeImpl(entries, this.level);
  }
  async del(key, tree) {
    const i = binarySearch2(key, this.entries);
    if (i === this.entries.length)
      return this;
    const childHash = this.entries[i][1];
    const oldChildNode = await tree.getNode(childHash);
    const oldHash = oldChildNode.hash;
    const childNode = await oldChildNode.del(key, tree);
    if (childNode.hash === oldHash)
      return this;
    if (childNode.entries.length === 0) {
      const entries = readonlySplice(this.entries, i, 1);
      return tree.newInternalNodeImpl(entries, this.level);
    }
    if (i === 0 && this.entries.length === 1)
      return childNode;
    if (childNode.getChildNodeSize(tree) > tree.minSize) {
      const entry = createNewInternalEntryForNode(childNode, tree.getEntrySize);
      return this.#replaceChild(tree, i, entry);
    }
    return this.#mergeAndPartition(tree, i, childNode);
  }
  async* keys(tree) {
    for (const entry of this.entries)
      yield* (await tree.getNode(entry[1])).keys(tree);
  }
  async* entriesIter(tree) {
    for (const entry of this.entries)
      yield* (await tree.getNode(entry[1])).entriesIter(tree);
  }
  getChildren(start, length, tree) {
    const ps = [];
    for (let i = start;i < length && i < this.entries.length; i++)
      ps.push(tree.getNode(this.entries[i][1]));
    return Promise.all(ps);
  }
  async getCompositeChildren(start, length, tree) {
    const { level } = this;
    if (length === 0)
      return new InternalNodeImpl2([], newRandomHash(), level - 1, true);
    const output = await this.getChildren(start, start + length, tree);
    if (level > 1) {
      const entries2 = [];
      for (const child of output)
        entries2.push(...child.entries);
      return new InternalNodeImpl2(entries2, newRandomHash(), level - 1, true);
    }
    assert(level === 1, "Expected level to be 1");
    const entries = [];
    for (const child of output)
      entries.push(...child.entries);
    return new DataNodeImpl(entries, newRandomHash(), true);
  }
};
function newNodeImpl(entries, hash, level, isMutable) {
  if (level === 0)
    return new DataNodeImpl(entries, hash, isMutable);
  return new InternalNodeImpl(entries, hash, level, isMutable);
}
function isDataNodeImpl(node) {
  return node.level === 0;
}
function partition(values, getSizeOfEntry, min, max) {
  const partitions = [];
  const sizes = [];
  let sum = 0;
  let accum = [];
  for (const value of values) {
    const size = getSizeOfEntry(value);
    if (size >= max) {
      if (accum.length > 0) {
        partitions.push(accum);
        sizes.push(sum);
      }
      partitions.push([value]);
      sizes.push(size);
      sum = 0;
      accum = [];
    } else if (sum + size >= min) {
      accum.push(value);
      partitions.push(accum);
      sizes.push(sum + size);
      sum = 0;
      accum = [];
    } else {
      sum += size;
      accum.push(value);
    }
  }
  if (sum > 0)
    if (sizes.length > 0 && sum + sizes[sizes.length - 1] <= max)
      partitions[partitions.length - 1].push(...accum);
    else
      partitions.push(accum);
  return partitions;
}
var emptyDataNode = makeNodeChunkData(0, [], 7);
var emptyDataNodeImpl = new DataNodeImpl([], emptyHash, false);
function createNewInternalEntryForNode(node, getSizeOfEntry) {
  const key = node.maxKey();
  const value = node.hash;
  return [
    key,
    value,
    getSizeOfEntry(key, value)
  ];
}

// node_modules/@rocicorp/zero/out/shared/src/size-of-value.js
var SIZE_TAG = 1;
var SIZE_INT32 = 4;
var SIZE_SMI = 5;
var SIZE_DOUBLE = 8;
function getSizeOfValue(value) {
  switch (typeof value) {
    case "string":
      return SIZE_TAG + SIZE_INT32 + value.length;
    case "number":
      if (isSmi(value)) {
        if (value <= -(2 ** 30) || value >= 2 ** 30 - 1)
          return SIZE_TAG + SIZE_SMI;
        return SIZE_TAG + SIZE_INT32;
      }
      return SIZE_TAG + SIZE_DOUBLE;
    case "boolean":
      return SIZE_TAG;
    case "object":
      if (value === null)
        return SIZE_TAG;
      if (Array.isArray(value)) {
        let sum = 2 * SIZE_TAG + SIZE_INT32;
        for (const element of value)
          sum += getSizeOfValue(element);
        return sum;
      }
      {
        const val = value;
        let sum = 2 * SIZE_TAG + SIZE_INT32;
        for (const k in val)
          if (hasOwn(val, k)) {
            const propertyValue = val[k];
            if (propertyValue !== undefined)
              sum += getSizeOfValue(k) + getSizeOfValue(propertyValue);
          }
        return sum;
      }
  }
  throw new Error(`Invalid value. type: ${typeof value}, value: ${value}`);
}
function isSmi(value) {
  return value === (value | 0);
}
var entryFixed = 2 * SIZE_TAG + SIZE_INT32 + SIZE_TAG + SIZE_INT32;
function getSizeOfEntry(key, value) {
  return entryFixed + getSizeOfValue(key) + getSizeOfValue(value);
}

// node_modules/@rocicorp/zero/out/replicache/src/btree/splice.js
var SPLICE_UNASSIGNED = -1;
var KEY = 0;
var VALUE = 1;
function* computeSplices(previous, current) {
  let previousIndex = 0;
  let currentIndex = 0;
  let splice;
  function ensureAssigned(splice2, index) {
    if (splice2[3] === SPLICE_UNASSIGNED)
      splice2[3] = index;
  }
  function newSplice() {
    return [
      previousIndex,
      0,
      0,
      SPLICE_UNASSIGNED
    ];
  }
  while (previousIndex < previous.length && currentIndex < current.length)
    if (previous[previousIndex][KEY] === current[currentIndex][KEY]) {
      if (deepEqual(previous[previousIndex][VALUE], current[currentIndex][VALUE])) {
        if (splice) {
          ensureAssigned(splice, 0);
          yield splice;
          splice = undefined;
        }
      } else {
        if (!splice)
          splice = newSplice();
        splice[2]++;
        splice[1]++;
        ensureAssigned(splice, currentIndex);
      }
      previousIndex++;
      currentIndex++;
    } else if (previous[previousIndex][KEY] < current[currentIndex][KEY]) {
      if (!splice)
        splice = newSplice();
      splice[1]++;
      previousIndex++;
    } else {
      if (!splice)
        splice = newSplice();
      splice[2]++;
      ensureAssigned(splice, currentIndex);
      currentIndex++;
    }
  if (currentIndex < current.length) {
    if (!splice)
      splice = newSplice();
    splice[2] += current.length - currentIndex;
    ensureAssigned(splice, currentIndex);
  }
  if (previousIndex < previous.length) {
    if (!splice)
      splice = newSplice();
    splice[1] += previous.length - previousIndex;
  }
  if (splice) {
    ensureAssigned(splice, 0);
    yield splice;
  }
}

// node_modules/@rocicorp/zero/out/replicache/src/btree/read.js
var BTreeRead = class {
  _cache = /* @__PURE__ */ new Map;
  _dagRead;
  _formatVersion;
  rootHash;
  getEntrySize;
  chunkHeaderSize;
  constructor(dagRead, formatVersion, root = emptyHash, getEntrySize = getSizeOfEntry, chunkHeaderSize = 11) {
    this._dagRead = dagRead;
    this._formatVersion = formatVersion;
    this.rootHash = root;
    this.getEntrySize = getEntrySize;
    this.chunkHeaderSize = chunkHeaderSize;
  }
  async getNode(hash) {
    if (hash === emptyHash)
      return emptyDataNodeImpl;
    const cached = this._cache.get(hash);
    if (cached)
      return cached;
    const data = parseBTreeNode((await this._dagRead.mustGetChunk(hash)).data, this._formatVersion, this.getEntrySize);
    const impl = newNodeImpl(data[1], hash, data[0], false);
    this._cache.set(hash, impl);
    return impl;
  }
  async get(key) {
    const leaf = await findLeaf(key, this.rootHash, this, this.rootHash);
    const index = binarySearch2(key, leaf.entries);
    if (!binarySearchFound(index, leaf.entries, key))
      return;
    return leaf.entries[index][1];
  }
  async has(key) {
    const leaf = await findLeaf(key, this.rootHash, this, this.rootHash);
    return binarySearchFound(binarySearch2(key, leaf.entries), leaf.entries, key);
  }
  async isEmpty() {
    const { rootHash } = this;
    const node = await this.getNode(this.rootHash);
    if (this.rootHash !== rootHash)
      return this.isEmpty();
    return node.entries.length === 0;
  }
  scan(fromKey) {
    return scanForHash(this.rootHash, () => this.rootHash, this.rootHash, fromKey, async (hash) => {
      const cached = await this.getNode(hash);
      if (cached)
        return [cached.level, cached.isMutable ? cached.entries.slice() : cached.entries];
      return parseBTreeNode((await this._dagRead.mustGetChunk(hash)).data, this._formatVersion, this.getEntrySize);
    });
  }
  async* keys() {
    yield* (await this.getNode(this.rootHash)).keys(this);
  }
  async* entries() {
    yield* (await this.getNode(this.rootHash)).entriesIter(this);
  }
  [Symbol.asyncIterator]() {
    return this.entries();
  }
  async* diff(last) {
    const [currentNode, lastNode] = await Promise.all([this.getNode(this.rootHash), last.getNode(last.rootHash)]);
    yield* diffNodes(lastNode, currentNode, last, this);
  }
};
async function* diffNodes(last, current, lastTree, currentTree) {
  if (last.level > current.level) {
    yield* diffNodes(await last.getCompositeChildren(0, last.entries.length, lastTree), current, lastTree, currentTree);
    return;
  }
  if (current.level > last.level) {
    yield* diffNodes(last, await current.getCompositeChildren(0, current.entries.length, currentTree), lastTree, currentTree);
    return;
  }
  if (isDataNodeImpl(last) && isDataNodeImpl(current)) {
    yield* diffEntries(last.entries, current.entries);
    return;
  }
  const initialSplices = computeSplices(last.entries, current.entries);
  for (const splice of initialSplices) {
    const [lastChild, currentChild] = await Promise.all([last.getCompositeChildren(splice[0], splice[1], lastTree), current.getCompositeChildren(splice[3], splice[2], currentTree)]);
    yield* diffNodes(lastChild, currentChild, lastTree, currentTree);
  }
}
function* diffEntries(lastEntries, currentEntries) {
  const lastLength = lastEntries.length;
  const currentLength = currentEntries.length;
  let i = 0;
  let j = 0;
  while (i < lastLength && j < currentLength) {
    const lastKey = lastEntries[i][0];
    const currentKey = currentEntries[j][0];
    if (lastKey === currentKey) {
      if (!deepEqual(lastEntries[i][1], currentEntries[j][1]))
        yield {
          op: "change",
          key: lastKey,
          oldValue: lastEntries[i][1],
          newValue: currentEntries[j][1]
        };
      i++;
      j++;
    } else if (lastKey < currentKey) {
      yield {
        op: "del",
        key: lastKey,
        oldValue: lastEntries[i][1]
      };
      i++;
    } else {
      yield {
        op: "add",
        key: currentKey,
        newValue: currentEntries[j][1]
      };
      j++;
    }
  }
  for (;i < lastLength; i++)
    yield {
      op: "del",
      key: lastEntries[i][0],
      oldValue: lastEntries[i][1]
    };
  for (;j < currentLength; j++)
    yield {
      op: "add",
      key: currentEntries[j][0],
      newValue: currentEntries[j][1]
    };
}
async function* scanForHash(expectedRootHash, getRootHash, hash, fromKey, readNode) {
  if (hash === emptyHash)
    return;
  const data = await readNode(hash);
  const entries = data[1];
  let i = 0;
  if (fromKey)
    i = binarySearch2(fromKey, entries);
  if (data[0] > 0)
    for (;i < entries.length; i++) {
      yield* scanForHash(expectedRootHash, getRootHash, entries[i][1], fromKey, readNode);
      fromKey = "";
    }
  else
    for (;i < entries.length; i++) {
      const rootHash = getRootHash();
      if (expectedRootHash !== rootHash) {
        yield* scanForHash(rootHash, getRootHash, rootHash, entries[i][0], readNode);
        return;
      }
      yield entries[i];
    }
}
async function allEntriesAsDiff(map, op) {
  const diff = [];
  const make = op === "add" ? (entry) => ({
    op: "add",
    key: entry[0],
    newValue: entry[1]
  }) : (entry) => ({
    op: "del",
    key: entry[0],
    oldValue: entry[1]
  });
  for await (const entry of map.entries())
    diff.push(make(entry));
  return diff;
}

// node_modules/@rocicorp/zero/out/shared/src/string-compare.js
function stringCompare(a, b) {
  if (a === b)
    return 0;
  if (a < b)
    return -1;
  return 1;
}

// node_modules/@rocicorp/zero/out/replicache/src/cookies.js
function compareCookies(a, b) {
  if (a === b)
    return 0;
  if (a === null)
    return -1;
  if (b === null)
    return 1;
  const cva = getCompareValue(a);
  const cvb = getCompareValue(b);
  if (typeof cva === "string" || typeof cvb === "string")
    return stringCompare(String(cva), String(cvb));
  return cva - cvb;
}
function getCompareValue(cookie) {
  if (typeof cookie === "string" || typeof cookie === "number")
    return cookie;
  return cookie.order;
}
function assertCookie(v) {
  if (v === null || typeof v === "string" || typeof v === "number")
    return;
  assertJSONObject(v);
  if (typeof v.order === "string" || typeof v.order === "number")
    return;
  throw new Error("Invalid cookie");
}

// node_modules/@rocicorp/zero/out/replicache/src/dag/chunk.js
function asRefs(sortedRefs) {
  return sortedRefs;
}
function toRefs(refs) {
  if (Array.isArray(refs)) {
    refs.sort();
    for (let i = 1;i < refs.length; i++)
      assert(refs[i - 1] !== refs[i], "Refs must not have duplicates");
    return asRefs(refs);
  }
  const refsArray = [...refs];
  refsArray.sort();
  return asRefs(refsArray);
}
var Chunk = class {
  hash;
  data;
  meta;
  constructor(hash, data, refs) {
    assert(!refs.includes(hash), "Chunk cannot reference itself");
    assertDeepFrozen(data);
    this.hash = hash;
    this.data = data;
    this.meta = refs;
  }
};
function assertRefs(v) {
  if (!Array.isArray(v))
    throw new Error("Refs must be an array");
  if (v.length > 0) {
    assertString(v[0]);
    for (let i = 1;i < v.length; i++)
      assertString(v[i]);
  }
}
function createChunk(data, refs, chunkHasher) {
  return new Chunk(chunkHasher(), data, refs);
}

// node_modules/@rocicorp/zero/out/replicache/src/dag/store.js
var ChunkNotFoundError = class extends Error {
  name = "ChunkNotFoundError";
  hash;
  constructor(hash) {
    super(`Chunk not found ${hash}`);
    this.hash = hash;
  }
};
async function mustGetChunk(store, hash) {
  const chunk = await store.getChunk(hash);
  if (chunk)
    return chunk;
  throw new ChunkNotFoundError(hash);
}
async function mustGetHeadHash(name, store) {
  const hash = await store.getHead(name);
  assert(hash, `Missing head ${name}`);
  return hash;
}

// node_modules/@rocicorp/zero/out/replicache/src/db/commit.js
var DEFAULT_HEAD_NAME = "main";
function commitIsLocalDD31(commit) {
  return isLocalMetaDD31(commit.meta);
}
function commitIsLocal(commit) {
  return commitIsLocalDD31(commit);
}
function commitIsSnapshot(commit) {
  return isSnapshotMetaDD31(commit.meta);
}
var Commit = class {
  chunk;
  constructor(chunk) {
    this.chunk = chunk;
  }
  get meta() {
    return this.chunk.data.meta;
  }
  get valueHash() {
    return this.chunk.data.valueHash;
  }
  getMutationID(clientID, dagRead) {
    return getMutationID(clientID, dagRead, this.meta);
  }
  async getNextMutationID(clientID, dagRead) {
    return await this.getMutationID(clientID, dagRead) + 1;
  }
  get indexes() {
    return this.chunk.data.indexes;
  }
};
async function getMutationID(clientID, dagRead, meta) {
  switch (meta.type) {
    case 5:
      return meta.lastMutationIDs[clientID] ?? 0;
    case 4: {
      if (meta.clientID === clientID)
        return meta.mutationID;
      const { basisHash } = meta;
      return getMutationID(clientID, dagRead, (await commitFromHash(basisHash, dagRead)).meta);
    }
    default:
      unreachable(meta);
  }
}
async function localMutations(fromCommitHash, dagRead) {
  return (await commitChain(fromCommitHash, dagRead)).filter((c) => commitIsLocal(c));
}
async function localMutationsDD31(fromCommitHash, dagRead) {
  return (await commitChain(fromCommitHash, dagRead)).filter((c) => commitIsLocalDD31(c));
}
async function localMutationsGreaterThan(commit, mutationIDLimits, dagRead) {
  const commits = [];
  const remainingMutationIDLimits = new Map(Object.entries(mutationIDLimits));
  while (!commitIsSnapshot(commit) && remainingMutationIDLimits.size > 0) {
    if (commitIsLocalDD31(commit)) {
      const { meta } = commit;
      const mutationIDLowerLimit = remainingMutationIDLimits.get(meta.clientID);
      if (mutationIDLowerLimit !== undefined)
        if (meta.mutationID <= mutationIDLowerLimit)
          remainingMutationIDLimits.delete(meta.clientID);
        else
          commits.push(commit);
    }
    const { basisHash } = commit.meta;
    if (basisHash === null)
      throw new Error(`Commit ${commit.chunk.hash} has no basis`);
    commit = await commitFromHash(basisHash, dagRead);
  }
  return commits;
}
async function baseSnapshotFromHead(name, dagRead) {
  const hash = await dagRead.getHead(name);
  assert(hash, `Missing head ${name}`);
  return baseSnapshotFromHash(hash, dagRead);
}
async function baseSnapshotHashFromHash(hash, dagRead) {
  return (await baseSnapshotFromHash(hash, dagRead)).chunk.hash;
}
async function baseSnapshotFromHash(hash, dagRead) {
  return baseSnapshotFromCommit(await commitFromHash(hash, dagRead), dagRead);
}
async function baseSnapshotFromCommit(commit, dagRead) {
  while (!commitIsSnapshot(commit)) {
    const { meta } = commit;
    if (isLocalMetaDD31(meta))
      commit = await commitFromHash(meta.baseSnapshotHash, dagRead);
    else {
      const { basisHash } = meta;
      if (basisHash === null)
        throw new Error(`Commit ${commit.chunk.hash} has no basis`);
      commit = await commitFromHash(basisHash, dagRead);
    }
  }
  return commit;
}
function snapshotMetaParts(c, clientID) {
  const m = c.meta;
  return [m.lastMutationIDs[clientID] ?? 0, m.cookieJSON];
}
function compareCookiesForSnapshots(a, b) {
  return compareCookies(a.meta.cookieJSON, b.meta.cookieJSON);
}
async function commitChain(fromCommitHash, dagRead) {
  let commit = await commitFromHash(fromCommitHash, dagRead);
  const commits = [];
  while (!commitIsSnapshot(commit)) {
    const { meta } = commit;
    const { basisHash } = meta;
    if (basisHash === null)
      throw new Error(`Commit ${commit.chunk.hash} has no basis`);
    commits.push(commit);
    commit = await commitFromHash(basisHash, dagRead);
  }
  commits.push(commit);
  return commits;
}
async function commitFromHash(hash, dagRead) {
  return fromChunk(await dagRead.mustGetChunk(hash));
}
async function commitFromHead(name, dagRead) {
  return commitFromHash(await mustGetHeadHash(name, dagRead), dagRead);
}
function assertLocalMetaDD31(v) {
  assertString(v.clientID);
  assertNumber(v.mutationID);
  assertString(v.mutatorName);
  if (!v.mutatorName)
    throw new Error("Missing mutator name");
  assertJSONValue(v.mutatorArgsJSON);
  if (v.originalHash !== null)
    assertHash(v.originalHash);
  assertNumber(v.timestamp);
}
function isLocalMetaDD31(meta) {
  return meta.type === 4;
}
function assertSnapshotMetaDD31(v) {
  if (v.basisHash !== null)
    assertHash(v.basisHash);
  assertJSONValue(v.cookieJSON);
  assertLastMutationIDs(v.lastMutationIDs);
}
function assertLastMutationIDs(v) {
  assertObject(v);
  for (const e of Object.values(v))
    assertNumber(e);
}
function assertSnapshotCommitDD31(c) {
  assertSnapshotMetaDD31(c.meta);
}
function isSnapshotMetaDD31(meta) {
  return meta.type === 5;
}
function assertMeta(v) {
  assertObject(v);
  assertDeepFrozen(v);
  if (v.basisHash !== null)
    assertString(v.basisHash);
  assertNumber(v.type);
  switch (v.type) {
    case 4:
      assertLocalMetaDD31(v);
      break;
    case 5:
      assertSnapshotMetaDD31(v);
      break;
    default:
      throw new Error(`Invalid enum value ${v.type}`);
  }
}
function chunkIndexDefinitionEqualIgnoreName(a, b) {
  return a.jsonPointer === b.jsonPointer && (a.allowEmpty ?? false) === (b.allowEmpty ?? false) && a.keyPrefix === b.keyPrefix;
}
function assertChunkIndexDefinition(v) {
  assertObject(v);
  assertDeepFrozen(v);
  assertString(v.name);
  assertString(v.keyPrefix);
  assertString(v.jsonPointer);
  if (v.allowEmpty !== undefined)
    assertBoolean(v.allowEmpty);
}
function toChunkIndexDefinition(name, indexDefinition) {
  return {
    name,
    keyPrefix: indexDefinition.prefix ?? "",
    jsonPointer: indexDefinition.jsonPointer,
    allowEmpty: indexDefinition.allowEmpty ?? false
  };
}
function assertIndexRecord(v) {
  assertObject(v);
  assertDeepFrozen(v);
  assertChunkIndexDefinition(v.definition);
  assertString(v.valueHash);
}
function assertIndexRecords(v) {
  assertArray(v);
  assertDeepFrozen(v);
  for (const ir of v)
    assertIndexRecord(ir);
}
function newLocalDD31(createChunk2, basisHash, baseSnapshotHash, mutationID, mutatorName, mutatorArgsJSON, originalHash, valueHash, indexes, timestamp, clientID) {
  return commitFromCommitData(createChunk2, makeCommitData({
    type: 4,
    basisHash,
    baseSnapshotHash,
    mutationID,
    mutatorName,
    mutatorArgsJSON,
    originalHash,
    timestamp,
    clientID
  }, valueHash, indexes));
}
function newSnapshotDD31(createChunk2, basisHash, lastMutationIDs, cookieJSON, valueHash, indexes) {
  return commitFromCommitData(createChunk2, newSnapshotCommitDataDD31(basisHash, lastMutationIDs, cookieJSON, valueHash, indexes));
}
function newSnapshotCommitDataDD31(basisHash, lastMutationIDs, cookieJSON, valueHash, indexes) {
  return makeCommitData({
    type: 5,
    basisHash,
    lastMutationIDs,
    cookieJSON
  }, valueHash, indexes);
}
function fromChunk(chunk) {
  validateChunk(chunk);
  return new Commit(chunk);
}
function commitFromCommitData(createChunk2, data) {
  return new Commit(createChunk2(data, getRefs(data)));
}
function getRefs(data) {
  const refs = /* @__PURE__ */ new Set;
  refs.add(data.valueHash);
  const { meta } = data;
  switch (meta.type) {
    case 4:
      meta.basisHash && refs.add(meta.basisHash);
      break;
    case 5:
      break;
    default:
      unreachable(meta);
  }
  for (const index of data.indexes)
    refs.add(index.valueHash);
  return toRefs(refs);
}
function makeCommitData(meta, valueHash, indexes) {
  return deepFreeze({
    meta,
    valueHash,
    indexes
  });
}
function assertCommitData(v) {
  if (isProd)
    return;
  assertObject(v);
  assertDeepFrozen(v);
  assertMeta(v.meta);
  assertString(v.valueHash);
  assertIndexRecords(v.indexes);
}
function validateChunk(chunk) {
  const { data } = chunk;
  assertCommitData(data);
  const seen = /* @__PURE__ */ new Set;
  for (const index of data.indexes) {
    const { name } = index.definition;
    if (seen.has(name))
      throw new Error(`Duplicate index ${name}`);
    seen.add(name);
  }
}

// node_modules/@rocicorp/zero/out/replicache/src/db/index.js
var IndexRead = class {
  meta;
  map;
  constructor(meta, map) {
    this.meta = meta;
    this.map = map;
  }
};
var IndexWrite = class extends IndexRead {
  flush() {
    return this.map.flush();
  }
  clear() {
    return this.map.clear();
  }
};
async function indexValue(lc, index, op, key, val, jsonPointer, allowEmpty) {
  try {
    for (const entry of getIndexKeys(key, val, jsonPointer, allowEmpty))
      switch (op) {
        case 0:
          await index.put(entry, val);
          break;
        case 1:
          await index.del(entry);
          break;
      }
  } catch (e) {
    lc.info?.("Not indexing value", val, ":", e);
  }
}
function getIndexKeys(primary, value, jsonPointer, allowEmpty) {
  const target = evaluateJSONPointer(value, jsonPointer);
  if (target === undefined) {
    if (allowEmpty)
      return [];
    throw new Error(`No value at path: ${jsonPointer}`);
  }
  const values = Array.isArray(target) ? target : [target];
  const indexKeys = [];
  for (const value2 of values)
    if (typeof value2 === "string")
      indexKeys.push(encodeIndexKey([value2, primary]));
    else
      throw new Error("Unsupported target type");
  return indexKeys;
}
function encodeIndexKey(indexKey) {
  const secondary = indexKey[0];
  const primary = indexKey[1];
  if (secondary.includes("\x00"))
    throw new Error("Secondary key cannot contain null byte");
  return "\x00" + secondary + "\x00" + primary;
}
function encodeIndexScanKey(secondary, primary) {
  const k = encodeIndexKey([secondary, primary || ""]);
  if (primary === undefined)
    return k.slice(0, k.length - 1);
  return k;
}
function decodeIndexKey(encodedIndexKey) {
  if (encodedIndexKey[0] !== "\x00")
    throw new Error("Invalid version");
  const versionLen = 1;
  const separatorLen = 1;
  const separatorOffset = encodedIndexKey.indexOf("\x00", versionLen);
  if (separatorOffset === -1)
    throw new Error("Invalid formatting");
  return [encodedIndexKey.slice(versionLen, separatorOffset), encodedIndexKey.slice(separatorOffset + separatorLen)];
}
function evaluateJSONPointer(value, pointer) {
  function parseIndex(s) {
    if (s.startsWith("+") || s.startsWith("0") && s.length !== 1)
      return;
    return parseInt(s, 10);
  }
  if (pointer === "")
    return value;
  if (!pointer.startsWith("/"))
    throw new Error(`Invalid JSON pointer: ${pointer}`);
  const tokens = pointer.split("/").slice(1).map((x) => x.replace(/~1/g, "/").replace(/~0/g, "~"));
  let target = value;
  for (const token of tokens) {
    let targetOpt;
    if (Array.isArray(target)) {
      const i = parseIndex(token);
      if (i === undefined)
        return;
      targetOpt = target[i];
    } else if (target === null)
      return;
    else if (typeof target === "object") {
      target = target;
      targetOpt = target[token];
    }
    if (targetOpt === undefined)
      return;
    target = targetOpt;
  }
  return target;
}

// node_modules/@rocicorp/zero/out/replicache/src/db/read.js
var Read = class {
  #dagRead;
  map;
  indexes;
  constructor(dagRead, map, indexes) {
    this.#dagRead = dagRead;
    this.map = map;
    this.indexes = indexes;
  }
  has(key) {
    return this.map.has(key);
  }
  get(key) {
    return this.map.get(key);
  }
  isEmpty() {
    return this.map.isEmpty();
  }
  getMapForIndex(indexName) {
    const idx = this.indexes.get(indexName);
    if (idx === undefined)
      throw new Error(`Unknown index name: ${indexName}`);
    return idx.map;
  }
  get closed() {
    return this.#dagRead.closed;
  }
  close() {
    this.#dagRead.release();
  }
};
function readFromDefaultHead(dagRead, formatVersion) {
  return readFromHead(DEFAULT_HEAD_NAME, dagRead, formatVersion);
}
async function readFromHead(name, dagRead, formatVersion) {
  return readFromCommit(await commitFromHead(name, dagRead), dagRead, formatVersion);
}
async function readFromHash(hash, dagRead, formatVersion) {
  return readFromCommit(await commitFromHash(hash, dagRead), dagRead, formatVersion);
}
function readFromCommit(commit, dagRead, formatVersion) {
  const indexes = readIndexesForRead(commit, dagRead, formatVersion);
  return new Read(dagRead, new BTreeRead(dagRead, formatVersion, commit.valueHash), indexes);
}
function readIndexesForRead(commit, dagRead, formatVersion) {
  const m = /* @__PURE__ */ new Map;
  for (const index of commit.indexes)
    m.set(index.definition.name, new IndexRead(index, new BTreeRead(dagRead, formatVersion, index.valueHash)));
  return m;
}

// node_modules/@rocicorp/zero/out/replicache/src/with-transactions.js
function withRead(store, fn) {
  return using(store.read(), fn);
}
function withWriteNoImplicitCommit(store, fn) {
  return using(store.write(), fn);
}
function withWrite(store, fn) {
  return using(store.write(), async (write) => {
    const result = await fn(write);
    await write.commit();
    return result;
  });
}
async function using(x, fn) {
  const write = await x;
  try {
    return await fn(write);
  } finally {
    write.release();
  }
}

// node_modules/@rocicorp/zero/out/replicache/src/index-defs.js
var indexDefinitionsSchema = readonlyRecord(readonlyObject({
  prefix: valita_exports.string().optional(),
  jsonPointer: valita_exports.string(),
  allowEmpty: valita_exports.boolean().optional()
}));
function indexDefinitionEqual(a, b) {
  return a.jsonPointer === b.jsonPointer && (a.allowEmpty ?? false) === (b.allowEmpty ?? false) && (a.prefix ?? "") === (b.prefix ?? "");
}
function indexDefinitionsEqual(a, b) {
  if (Object.keys(a).length !== Object.keys(b).length)
    return false;
  for (const [aKey, aValue] of Object.entries(a)) {
    const bValue = b[aKey];
    if (!bValue || !indexDefinitionEqual(aValue, bValue))
      return false;
  }
  return true;
}

// node_modules/@rocicorp/zero/out/replicache/src/persist/client-groups.js
var clientGroupSchema = readonlyObject({
  headHash: hashSchema,
  mutatorNames: readonlyArray(valita_exports.string()),
  indexes: indexDefinitionsSchema,
  mutationIDs: readonlyRecord(valita_exports.number()),
  lastServerAckdMutationIDs: valita_exports.record(valita_exports.number()),
  disabled: valita_exports.boolean()
});
var CLIENT_GROUPS_HEAD_NAME = "client-groups";
function assertClientGroup(value) {
  assert2(value, clientGroupSchema);
}
function chunkDataToClientGroupMap(chunkData) {
  assertObject(chunkData);
  const clientGroups = /* @__PURE__ */ new Map;
  for (const [key, value] of Object.entries(chunkData))
    if (value !== undefined) {
      assertClientGroup(value);
      clientGroups.set(key, value);
    }
  return clientGroups;
}
function clientGroupMapToChunkData(clientGroups, dagWrite) {
  const chunkData = {};
  for (const [clientGroupID, clientGroup] of clientGroups.entries()) {
    dagWrite.assertValidHash(clientGroup.headHash);
    chunkData[clientGroupID] = {
      ...clientGroup,
      mutatorNames: [...clientGroup.mutatorNames.values()]
    };
  }
  return deepFreeze(chunkData);
}
async function getClientGroupsAtHash(hash, dagRead) {
  return chunkDataToClientGroupMap((await dagRead.getChunk(hash))?.data);
}
async function getClientGroups(dagRead) {
  const hash = await dagRead.getHead(CLIENT_GROUPS_HEAD_NAME);
  if (!hash)
    return /* @__PURE__ */ new Map;
  return getClientGroupsAtHash(hash, dagRead);
}
async function setClientGroups(clientGroups, dagWrite) {
  const currClientGroups = await getClientGroups(dagWrite);
  for (const [clientGroupID, clientGroup] of clientGroups)
    validateClientGroupUpdate(clientGroup, currClientGroups.get(clientGroupID));
  return setValidatedClientGroups(clientGroups, dagWrite);
}
async function setClientGroup(clientGroupID, clientGroup, dagWrite) {
  const currClientGroups = await getClientGroups(dagWrite);
  validateClientGroupUpdate(clientGroup, currClientGroups.get(clientGroupID));
  const newClientGroups = new Map(currClientGroups);
  newClientGroups.set(clientGroupID, clientGroup);
  return setValidatedClientGroups(newClientGroups, dagWrite);
}
function validateClientGroupUpdate(clientGroup, currClientGroup) {
  const mutatorNamesSet = new Set(clientGroup.mutatorNames);
  assert(mutatorNamesSet.size === clientGroup.mutatorNames.length, "A client group's mutatorNames must be a set.");
  if (currClientGroup !== undefined) {
    assert(indexDefinitionsEqual(currClientGroup.indexes, clientGroup.indexes), "A client group's index definitions must never change.");
    assert(mutatorNamesEqual(mutatorNamesSet, currClientGroup.mutatorNames), "A client group's mutatorNames must never change.");
  }
}
async function setValidatedClientGroups(clientGroups, dagWrite) {
  const chunkData = clientGroupMapToChunkData(clientGroups, dagWrite);
  const refs = /* @__PURE__ */ new Set;
  for (const clientGroup of clientGroups.values())
    refs.add(clientGroup.headHash);
  const chunk = dagWrite.createChunk(chunkData, toRefs(refs));
  await dagWrite.putChunk(chunk);
  await dagWrite.setHead(CLIENT_GROUPS_HEAD_NAME, chunk.hash);
  return clientGroups;
}
function mutatorNamesEqual(mutatorNamesSet, mutatorNames) {
  if (mutatorNames.length !== mutatorNamesSet.size)
    return false;
  for (const mutatorName of mutatorNames)
    if (!mutatorNamesSet.has(mutatorName))
      return false;
  return true;
}
async function getClientGroup(id, dagRead) {
  return (await getClientGroups(dagRead)).get(id);
}
function clientGroupHasPendingMutations(clientGroup) {
  for (const [clientID, mutationID] of Object.entries(clientGroup.mutationIDs)) {
    const lastServerAckdMutationID = clientGroup.lastServerAckdMutationIDs[clientID];
    if (lastServerAckdMutationID === undefined && mutationID !== 0 || lastServerAckdMutationID < mutationID)
      return true;
  }
  return false;
}
async function disableClientGroup(clientGroupID, dagWrite) {
  const clientGroup = await getClientGroup(clientGroupID, dagWrite);
  if (!clientGroup)
    return;
  await setClientGroup(clientGroupID, {
    ...clientGroup,
    disabled: true
  }, dagWrite);
}

// node_modules/@rocicorp/zero/out/replicache/src/async-iterable-to-array.js
async function asyncIterableToArray(it) {
  const arr2 = [];
  for await (const v of it)
    arr2.push(v);
  return arr2;
}

// node_modules/@rocicorp/zero/out/replicache/src/btree/diff.js
function diff(oldMap, newMap) {
  return asyncIterableToArray(newMap.diff(oldMap));
}

// node_modules/@rocicorp/resolver/out/resolver.js
function resolver() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// node_modules/@rocicorp/lock/out/lock.js
class Lock {
  _lockP = null;
  async lock() {
    const previous = this._lockP;
    const { promise, resolve } = resolver();
    this._lockP = promise;
    await previous;
    return resolve;
  }
  withLock(f) {
    return run(this.lock(), f);
  }
}

class RWLock {
  _lock = new Lock;
  _writeP = null;
  _readP = [];
  read() {
    return this._lock.withLock(async () => {
      await this._writeP;
      const { promise, resolve } = resolver();
      this._readP.push(promise);
      return resolve;
    });
  }
  withRead(f) {
    return run(this.read(), f);
  }
  async write() {
    return await this._lock.withLock(async () => {
      await this._writeP;
      await Promise.all(this._readP);
      const { promise, resolve } = resolver();
      this._writeP = promise;
      this._readP = [];
      return resolve;
    });
  }
  withWrite(f) {
    return run(this.write(), f);
  }
}
async function run(p, f) {
  const release = await p;
  try {
    return await f();
  } finally {
    release();
  }
}

// node_modules/@rocicorp/zero/out/replicache/src/btree/write.js
var BTreeWrite = class extends BTreeRead {
  #lock = new Lock;
  #modified = /* @__PURE__ */ new Map;
  minSize;
  maxSize;
  constructor(dagWrite, formatVersion, root = emptyHash, minSize = 8 * 1024, maxSize = 16 * 1024, getEntrySize = getSizeOfEntry, chunkHeaderSize) {
    super(dagWrite, formatVersion, root, getEntrySize, chunkHeaderSize);
    this.minSize = minSize;
    this.maxSize = maxSize;
  }
  #addToModified(node) {
    assert(node.isMutable, "Expected node to be mutable");
    this.#modified.set(node.hash, node);
    this._cache.set(node.hash, node);
  }
  updateNode(node) {
    assert(node.isMutable, "Expected node to be mutable");
    this.#modified.delete(node.hash);
    node.hash = newRandomHash();
    this.#addToModified(node);
  }
  newInternalNodeImpl(entries, level) {
    const n = new InternalNodeImpl(entries, newRandomHash(), level, true);
    this.#addToModified(n);
    return n;
  }
  newDataNodeImpl(entries) {
    const n = new DataNodeImpl(entries, newRandomHash(), true);
    this.#addToModified(n);
    return n;
  }
  newNodeImpl(entries, level) {
    const n = newNodeImpl(entries, newRandomHash(), level, true);
    this.#addToModified(n);
    return n;
  }
  put(key, value) {
    return this.#lock.withLock(async () => {
      const oldRootNode = await this.getNode(this.rootHash);
      const entrySize = this.getEntrySize(key, value);
      const rootNode = await oldRootNode.set(key, value, entrySize, this);
      if (rootNode.getChildNodeSize(this) > this.maxSize) {
        const headerSize = this.chunkHeaderSize;
        const partitions = partition(rootNode.entries, (value2) => value2[2], this.minSize - headerSize, this.maxSize - headerSize);
        const { level } = rootNode;
        const entries = partitions.map((entries2) => {
          return createNewInternalEntryForNode(this.newNodeImpl(entries2, level), this.getEntrySize);
        });
        this.rootHash = this.newInternalNodeImpl(entries, level + 1).hash;
        return;
      }
      this.rootHash = rootNode.hash;
    });
  }
  del(key) {
    return this.#lock.withLock(async () => {
      const newRootNode = await (await this.getNode(this.rootHash)).del(key, this);
      const found = this.rootHash !== newRootNode.hash;
      if (found)
        if (newRootNode.level > 0 && newRootNode.entries.length === 1)
          this.rootHash = newRootNode.entries[0][1];
        else
          this.rootHash = newRootNode.hash;
      return found;
    });
  }
  clear() {
    return this.#lock.withLock(() => {
      this.#modified.clear();
      this.rootHash = emptyHash;
    });
  }
  flush() {
    return this.#lock.withLock(async () => {
      const dagWrite = this._dagRead;
      if (this.rootHash === emptyHash) {
        const chunk = dagWrite.createChunk(emptyDataNode, []);
        await dagWrite.putChunk(chunk);
        return chunk.hash;
      }
      const newChunks = [];
      const newRoot = gatherNewChunks(this.rootHash, newChunks, dagWrite.createChunk, this.#modified, this._formatVersion);
      await Promise.all(newChunks.map((chunk) => dagWrite.putChunk(chunk)));
      this.#modified.clear();
      this.rootHash = newRoot;
      return newRoot;
    });
  }
};
function gatherNewChunks(hash, newChunks, createChunk2, modified, formatVersion) {
  const node = modified.get(hash);
  if (node === undefined)
    return hash;
  if (isDataNodeImpl(node)) {
    const chunk2 = createChunk2(toChunkData(node, formatVersion), []);
    newChunks.push(chunk2);
    return chunk2.hash;
  }
  const refs = [];
  const { entries } = node;
  for (let i = 0;i < entries.length; i++) {
    const entry = entries[i];
    const childHash = entry[1];
    const newChildHash = gatherNewChunks(childHash, newChunks, createChunk2, modified, formatVersion);
    if (newChildHash !== childHash)
      entries[i] = [
        entry[0],
        newChildHash,
        entry[2]
      ];
    refs.push(newChildHash);
  }
  const chunk = createChunk2(toChunkData(node, formatVersion), toRefs(refs));
  newChunks.push(chunk);
  return chunk.hash;
}

// node_modules/@rocicorp/zero/out/replicache/src/lazy.js
function lazy2(factory) {
  let value;
  return () => {
    if (value === undefined)
      value = factory();
    return value;
  };
}

// node_modules/@rocicorp/zero/out/replicache/src/sync/diff.js
var DiffsMap = class extends Map {
  set(key, value) {
    if (value.length === 0)
      return this;
    return super.set(key, value);
  }
};
async function diff2(oldHash, newHash, read, diffConfig, formatVersion) {
  const [oldCommit, newCommit] = await Promise.all([commitFromHash(oldHash, read), commitFromHash(newHash, read)]);
  return diffCommits(oldCommit, newCommit, read, diffConfig, formatVersion);
}
async function diffCommits(oldCommit, newCommit, read, diffConfig, formatVersion) {
  const diffsMap = new DiffsMap;
  if (!diffConfig.shouldComputeDiffs())
    return diffsMap;
  const valueDiff = await diff(new BTreeRead(read, formatVersion, oldCommit.valueHash), new BTreeRead(read, formatVersion, newCommit.valueHash));
  diffsMap.set("", valueDiff);
  await addDiffsForIndexes(oldCommit, newCommit, read, diffsMap, diffConfig, formatVersion);
  return diffsMap;
}
async function addDiffsForIndexes(mainCommit, syncCommit, read, diffsMap, diffConfig, formatVersion) {
  const oldIndexes = readIndexesForRead(mainCommit, read, formatVersion);
  const newIndexes = readIndexesForRead(syncCommit, read, formatVersion);
  for (const [oldIndexName, oldIndex] of oldIndexes) {
    if (!diffConfig.shouldComputeDiffsForIndex(oldIndexName))
      continue;
    const newIndex = newIndexes.get(oldIndexName);
    if (newIndex !== undefined) {
      assert(newIndex !== oldIndex, "Expected newIndex to differ from oldIndex");
      const diffs = await diff(oldIndex.map, newIndex.map);
      newIndexes.delete(oldIndexName);
      diffsMap.set(oldIndexName, diffs);
    } else {
      const diffs = await allEntriesAsDiff(oldIndex.map, "del");
      diffsMap.set(oldIndexName, diffs);
    }
  }
  for (const [newIndexName, newIndex] of newIndexes) {
    if (!diffConfig.shouldComputeDiffsForIndex(newIndexName))
      continue;
    const diffs = await allEntriesAsDiff(newIndex.map, "add");
    diffsMap.set(newIndexName, diffs);
  }
}

// node_modules/@rocicorp/zero/out/replicache/src/db/write.js
var Write = class extends Read {
  #dagWrite;
  #basis;
  #meta;
  #clientID;
  #formatVersion;
  constructor(dagWrite, map, basis, meta, indexes, clientID, formatVersion) {
    super(dagWrite, map, indexes);
    this.#dagWrite = dagWrite;
    this.#basis = basis;
    this.#meta = meta;
    this.#clientID = clientID;
    this.#formatVersion = formatVersion;
    if (basis === undefined)
      assert(meta.basisHash === emptyHash, "Expected basisHash to be emptyHash when basis is undefined");
    else
      assert(meta.basisHash === basis.chunk.hash, "Expected meta.basisHash to equal basis.chunk.hash");
  }
  async put(lc, key, value) {
    const oldVal = lazy2(() => this.map.get(key));
    await updateIndexes(lc, this.indexes, key, oldVal, value);
    await this.map.put(key, value);
  }
  getMutationID() {
    return getMutationID(this.#clientID, this.#dagWrite, this.#meta);
  }
  async del(lc, key) {
    const oldVal = lazy2(() => this.map.get(key));
    if (oldVal !== undefined)
      await updateIndexes(lc, this.indexes, key, oldVal, undefined);
    return this.map.del(key);
  }
  async clear() {
    await this.map.clear();
    const ps = [];
    for (const idx of this.indexes.values())
      ps.push(idx.clear());
    await Promise.all(ps);
  }
  async putCommit() {
    const valueHash = await this.map.flush();
    const indexRecords = [];
    for (const index of this.indexes.values()) {
      const valueHash2 = await index.flush();
      const indexRecord = {
        definition: index.meta.definition,
        valueHash: valueHash2
      };
      indexRecords.push(indexRecord);
    }
    let commit;
    const meta = this.#meta;
    switch (meta.type) {
      case 4: {
        assert(this.#formatVersion >= 5, "Expected formatVersion >= DD31 for LocalDD31 commit");
        const { basisHash, mutationID, mutatorName, mutatorArgsJSON, originalHash, timestamp } = meta;
        commit = newLocalDD31(this.#dagWrite.createChunk, basisHash, await baseSnapshotHashFromHash(basisHash, this.#dagWrite), mutationID, mutatorName, mutatorArgsJSON, originalHash, valueHash, indexRecords, timestamp, this.#clientID);
        break;
      }
      case 5: {
        assert(this.#formatVersion > 5, "Expected formatVersion > DD31 for SnapshotDD31 commit");
        const { basisHash, lastMutationIDs, cookieJSON } = meta;
        commit = newSnapshotDD31(this.#dagWrite.createChunk, basisHash, lastMutationIDs, cookieJSON, valueHash, indexRecords);
        break;
      }
    }
    await this.#dagWrite.putChunk(commit.chunk);
    return commit;
  }
  async commit(headName) {
    const commitHash = (await this.putCommit()).chunk.hash;
    await this.#dagWrite.setHead(headName, commitHash);
    await this.#dagWrite.commit();
    return commitHash;
  }
  async commitWithDiffs(headName, diffConfig) {
    const commit = this.putCommit();
    const diffMap = await this.#generateDiffs(diffConfig);
    const commitHash = (await commit).chunk.hash;
    await this.#dagWrite.setHead(headName, commitHash);
    await this.#dagWrite.commit();
    return [commitHash, diffMap];
  }
  async#generateDiffs(diffConfig) {
    const diffsMap = new DiffsMap;
    if (!diffConfig.shouldComputeDiffs())
      return diffsMap;
    let valueDiff = [];
    if (this.#basis)
      valueDiff = await diff(new BTreeRead(this.#dagWrite, this.#formatVersion, this.#basis.valueHash), this.map);
    diffsMap.set("", valueDiff);
    let basisIndexes;
    if (this.#basis)
      basisIndexes = readIndexesForRead(this.#basis, this.#dagWrite, this.#formatVersion);
    else
      basisIndexes = /* @__PURE__ */ new Map;
    for (const [name, index] of this.indexes) {
      if (!diffConfig.shouldComputeDiffsForIndex(name))
        continue;
      const basisIndex = basisIndexes.get(name);
      assert(index !== basisIndex, "Expected index to differ from basisIndex");
      const indexDiffResult = await (basisIndex ? diff(basisIndex.map, index.map) : allEntriesAsDiff(index.map, "add"));
      diffsMap.set(name, indexDiffResult);
    }
    for (const [name, basisIndex] of basisIndexes)
      if (!this.indexes.has(name) && diffConfig.shouldComputeDiffsForIndex(name)) {
        const indexDiffResult = await allEntriesAsDiff(basisIndex.map, "del");
        diffsMap.set(name, indexDiffResult);
      }
    return diffsMap;
  }
  close() {
    this.#dagWrite.release();
  }
};
async function newWriteLocal(basisHash, mutatorName, mutatorArgsJSON, originalHash, dagWrite, timestamp, clientID, formatVersion) {
  const basis = await commitFromHash(basisHash, dagWrite);
  const bTreeWrite = new BTreeWrite(dagWrite, formatVersion, basis.valueHash);
  const mutationID = await basis.getNextMutationID(clientID, dagWrite);
  const indexes = readIndexesForWrite(basis, dagWrite, formatVersion);
  assert(formatVersion >= 5, "Expected formatVersion >= DD31 for newWriteLocal");
  return new Write(dagWrite, bTreeWrite, basis, {
    type: 4,
    basisHash,
    baseSnapshotHash: await baseSnapshotHashFromHash(basisHash, dagWrite),
    mutatorName,
    mutatorArgsJSON,
    mutationID,
    originalHash,
    timestamp,
    clientID
  }, indexes, clientID, formatVersion);
}
async function newWriteSnapshotDD31(basisHash, lastMutationIDs, cookieJSON, dagWrite, clientID, formatVersion) {
  const basis = await commitFromHash(basisHash, dagWrite);
  return new Write(dagWrite, new BTreeWrite(dagWrite, formatVersion, basis.valueHash), basis, {
    basisHash,
    type: 5,
    lastMutationIDs,
    cookieJSON
  }, readIndexesForWrite(basis, dagWrite, formatVersion), clientID, formatVersion);
}
async function updateIndexes(lc, indexes, key, oldValGetter, newVal) {
  const ps = [];
  for (const idx of indexes.values()) {
    const { keyPrefix } = idx.meta.definition;
    if (!keyPrefix || key.startsWith(keyPrefix)) {
      const oldVal = await oldValGetter();
      if (oldVal !== undefined)
        ps.push(indexValue(lc, idx.map, 1, key, oldVal, idx.meta.definition.jsonPointer, idx.meta.definition.allowEmpty ?? false));
      if (newVal !== undefined)
        ps.push(indexValue(lc, idx.map, 0, key, newVal, idx.meta.definition.jsonPointer, idx.meta.definition.allowEmpty ?? false));
    }
  }
  await Promise.all(ps);
}
function readIndexesForWrite(commit, dagWrite, formatVersion) {
  const m = /* @__PURE__ */ new Map;
  for (const index of commit.indexes)
    m.set(index.definition.name, new IndexWrite(index, new BTreeWrite(dagWrite, formatVersion, index.valueHash)));
  return m;
}
async function createIndexBTree(lc, dagWrite, valueMap, prefix, jsonPointer, allowEmpty, formatVersion) {
  const indexMap = new BTreeWrite(dagWrite, formatVersion);
  for await (const entry of valueMap.scan(prefix)) {
    const key = entry[0];
    if (!key.startsWith(prefix))
      break;
    await indexValue(lc, indexMap, 0, key, entry[1], jsonPointer, allowEmpty);
  }
  return indexMap;
}

// node_modules/@rocicorp/zero/out/replicache/src/sync/ids.js
var clientGroupIDSchema = valita_exports.string();
var clientIDSchema = valita_exports.string();

// node_modules/@rocicorp/zero/out/replicache/src/persist/make-client-id.js
function makeClientID() {
  const length = 18;
  const high = randomUint64();
  const low = randomUint64();
  return (high << 64n | low).toString(32).slice(-length).padStart(length, "0");
}

// node_modules/@rocicorp/zero/out/replicache/src/persist/clients.js
var clientV5Schema = readonlyObject({
  heartbeatTimestampMs: valita_exports.number(),
  headHash: hashSchema,
  tempRefreshHash: hashSchema.nullable(),
  clientGroupID: clientGroupIDSchema
});
var clientV6Schema = readonlyObject({
  heartbeatTimestampMs: valita_exports.number(),
  refreshHashes: readonlyArray(hashSchema),
  persistHash: hashSchema.nullable(),
  clientGroupID: clientGroupIDSchema
});
function isClientV6(client) {
  return client.refreshHashes !== undefined;
}
var CLIENTS_HEAD_NAME = "clients";
var clientSchema = valita_exports.union(clientV5Schema, clientV6Schema);
function assertClient(value) {
  assert2(value, clientSchema);
}
function assertClientV6(value) {
  assert2(value, clientV6Schema);
}
function chunkDataToClientMap(chunkData) {
  assertObject(chunkData);
  const clients = /* @__PURE__ */ new Map;
  for (const key in chunkData)
    if (hasOwn(chunkData, key)) {
      const value = chunkData[key];
      if (value !== undefined) {
        assertClient(value);
        clients.set(key, value);
      }
    }
  return clients;
}
function clientMapToChunkData(clients, dagWrite) {
  for (const client of clients.values())
    if (isClientV6(client)) {
      client.refreshHashes.forEach(dagWrite.assertValidHash);
      if (client.persistHash)
        dagWrite.assertValidHash(client.persistHash);
    } else {
      dagWrite.assertValidHash(client.headHash);
      if (client.tempRefreshHash)
        dagWrite.assertValidHash(client.tempRefreshHash);
    }
  return deepFreeze(Object.fromEntries(clients));
}
async function getClients(dagRead) {
  return getClientsAtHash(await dagRead.getHead(CLIENTS_HEAD_NAME), dagRead);
}
async function getClientsAtHash(hash, dagRead) {
  if (!hash)
    return /* @__PURE__ */ new Map;
  return chunkDataToClientMap((await dagRead.getChunk(hash))?.data);
}
var ClientStateNotFoundError = class extends Error {
  name = "ClientStateNotFoundError";
  id;
  constructor(id) {
    super(`Client state not found, id: ${id}`);
    this.id = id;
  }
};
async function assertHasClientState(id, dagRead) {
  if (!await hasClientState(id, dagRead))
    throw new ClientStateNotFoundError(id);
}
async function hasClientState(id, dagRead) {
  return !!await getClient(id, dagRead);
}
async function getClient(id, dagRead) {
  return (await getClients(dagRead)).get(id);
}
async function mustGetClient(id, dagRead) {
  const client = await getClient(id, dagRead);
  if (!client)
    throw new ClientStateNotFoundError(id);
  return client;
}
function initClientV6(newClientID, lc, perdag, mutatorNames, indexes, formatVersion, enableClientGroupForking) {
  return withWrite(perdag, async (dagWrite) => {
    async function setClientsAndClientGroupAndCommit(basisHash, cookieJSON, valueHash2, indexRecords2) {
      const newSnapshotData = newSnapshotCommitDataDD31(basisHash, {}, cookieJSON, valueHash2, indexRecords2);
      const chunk = dagWrite.createChunk(newSnapshotData, getRefs(newSnapshotData));
      const newClientGroupID = makeClientID();
      const newClient = {
        heartbeatTimestampMs: Date.now(),
        refreshHashes: [chunk.hash],
        persistHash: null,
        clientGroupID: newClientGroupID
      };
      const newClients = new Map(clients).set(newClientID, newClient);
      const clientGroup = {
        headHash: chunk.hash,
        mutatorNames,
        indexes,
        mutationIDs: {},
        lastServerAckdMutationIDs: {},
        disabled: false
      };
      await Promise.all([
        dagWrite.putChunk(chunk),
        setClients(newClients, dagWrite),
        setClientGroup(newClientGroupID, clientGroup, dagWrite)
      ]);
      return [
        newClient,
        chunk.hash,
        newClients,
        true
      ];
    }
    const clients = await getClients(dagWrite);
    const res = await findMatchingClient(dagWrite, mutatorNames, indexes);
    if (res.type === 2) {
      const { clientGroupID, headHash } = res;
      const newClient = {
        clientGroupID,
        refreshHashes: [headHash],
        heartbeatTimestampMs: Date.now(),
        persistHash: null
      };
      const newClients = new Map(clients).set(newClientID, newClient);
      await setClients(newClients, dagWrite);
      return [
        newClient,
        headHash,
        newClients,
        false
      ];
    }
    if (!enableClientGroupForking || res.type === 0) {
      const emptyBTreeChunk = dagWrite.createChunk(emptyDataNode, []);
      await dagWrite.putChunk(emptyBTreeChunk);
      const indexRecords2 = [];
      for (const [name, indexDefinition] of Object.entries(indexes)) {
        const chunkIndexDefinition = toChunkIndexDefinition(name, indexDefinition);
        indexRecords2.push({
          definition: chunkIndexDefinition,
          valueHash: emptyBTreeChunk.hash
        });
      }
      return setClientsAndClientGroupAndCommit(null, null, emptyBTreeChunk.hash, indexRecords2);
    }
    assert(res.type === 1, "Expected result type to be FORK");
    const { snapshot } = res;
    const indexRecords = [];
    const { valueHash, indexes: oldIndexes } = snapshot;
    const map = new BTreeRead(dagWrite, formatVersion, valueHash);
    for (const [name, indexDefinition] of Object.entries(indexes)) {
      const { prefix = "", jsonPointer, allowEmpty = false } = indexDefinition;
      const chunkIndexDefinition = {
        name,
        keyPrefix: prefix,
        jsonPointer,
        allowEmpty
      };
      const oldIndex = findMatchingOldIndex(oldIndexes, chunkIndexDefinition);
      if (oldIndex)
        indexRecords.push({
          definition: chunkIndexDefinition,
          valueHash: oldIndex.valueHash
        });
      else {
        const indexBTree = await createIndexBTree(lc, dagWrite, map, prefix, jsonPointer, allowEmpty, formatVersion);
        indexRecords.push({
          definition: chunkIndexDefinition,
          valueHash: await indexBTree.flush()
        });
      }
    }
    return setClientsAndClientGroupAndCommit(snapshot.meta.basisHash, snapshot.meta.cookieJSON, snapshot.valueHash, indexRecords);
  });
}
function findMatchingOldIndex(oldIndexes, chunkIndexDefinition) {
  return oldIndexes.find((index) => chunkIndexDefinitionEqualIgnoreName(index.definition, chunkIndexDefinition));
}
async function findMatchingClient(dagRead, mutatorNames, indexes) {
  let newestCookie;
  let bestSnapshot;
  const mutatorNamesSet = new Set(mutatorNames);
  const clientGroups = await getClientGroups(dagRead);
  for (const [clientGroupID, clientGroup] of clientGroups) {
    if (!clientGroup.disabled && mutatorNamesEqual(mutatorNamesSet, clientGroup.mutatorNames) && indexDefinitionsEqual(indexes, clientGroup.indexes))
      return {
        type: 2,
        clientGroupID,
        headHash: clientGroup.headHash
      };
    const clientGroupSnapshotCommit = await baseSnapshotFromHash(clientGroup.headHash, dagRead);
    assertSnapshotCommitDD31(clientGroupSnapshotCommit);
    const { cookieJSON } = clientGroupSnapshotCommit.meta;
    if (newestCookie === undefined || compareCookies(cookieJSON, newestCookie) > 0) {
      newestCookie = cookieJSON;
      bestSnapshot = clientGroupSnapshotCommit;
    }
  }
  if (bestSnapshot)
    return {
      type: 1,
      snapshot: bestSnapshot
    };
  return { type: 0 };
}
function getRefsForClients(clients) {
  const refs = /* @__PURE__ */ new Set;
  for (const client of clients.values())
    if (isClientV6(client)) {
      for (const hash of client.refreshHashes)
        refs.add(hash);
      if (client.persistHash)
        refs.add(client.persistHash);
    } else {
      refs.add(client.headHash);
      if (client.tempRefreshHash)
        refs.add(client.tempRefreshHash);
    }
  return toRefs(refs);
}
async function getClientGroupForClient(clientID, read) {
  const clientGroupID = await getClientGroupIDForClient(clientID, read);
  if (!clientGroupID)
    return;
  return getClientGroup(clientGroupID, read);
}
async function getClientGroupIDForClient(clientID, read) {
  return (await getClient(clientID, read))?.clientGroupID;
}
async function setClient(clientID, client, dagWrite) {
  const clients = await getClients(dagWrite);
  return setClients(new Map(clients).set(clientID, client), dagWrite);
}
async function setClients(clients, dagWrite) {
  const chunkData = clientMapToChunkData(clients, dagWrite);
  const chunk = dagWrite.createChunk(chunkData, getRefsForClients(clients));
  await dagWrite.putChunk(chunk);
  await dagWrite.setHead(CLIENTS_HEAD_NAME, chunk.hash);
  return chunk.hash;
}

// node_modules/@rocicorp/zero/out/shared/src/objects.js
function mapValues(input, mapper) {
  return mapEntries(input, (k, v) => [k, mapper(v)]);
}
function mapEntries(input, mapper) {
  const output = {};
  for (const entry of Object.entries(input)) {
    const mapped = mapper(entry[0], entry[1]);
    output[mapped[0]] = mapped[1];
  }
  return output;
}
function mapAllEntries(input, mapper) {
  const output = {};
  for (const mapped of mapper(Object.entries(input)))
    output[mapped[0]] = mapped[1];
  return output;
}

// node_modules/@rocicorp/zero/out/zql/src/query/query-internals.js
var queryInternalsTag = Symbol();
function asQueryInternals(query) {
  assert(queryInternalsTag in query, "Query does not implement QueryInternals");
  return query;
}

// node_modules/@rocicorp/zero/out/shared/src/json-schema.js
var path = [];
var jsonSchema = valita_exports.unknown().chain((v) => {
  if (isProd)
    return ok(v);
  const rv = isJSONValue(v, path) ? ok(v) : err({
    message: `Not a JSON value`,
    path: path.slice()
  });
  path.length = 0;
  return rv;
});
var jsonObjectSchema = valita_exports.unknown().chain((v) => {
  if (isProd)
    return ok(v);
  const rv = isJSONObject(v, path) ? ok(v) : err({
    message: `Not a JSON object`,
    path: path.slice()
  });
  path.length = 0;
  return rv;
});

// node_modules/@rocicorp/zero/out/shared/src/arrays.js
function defined(arr2) {
  let i = arr2.findIndex((x) => x === undefined);
  if (i < 0)
    return arr2;
  const defined2 = arr2.slice(0, i);
  for (i++;i < arr2.length; i++) {
    const x = arr2[i];
    if (x !== undefined)
      defined2.push(x);
  }
  return defined2;
}
function areEqual(arr1, arr2) {
  return arr1.length === arr2.length && arr1.every((e, i) => e === arr2[i]);
}

// node_modules/@rocicorp/zero/out/shared/src/must.js
function must(v, msg) {
  if (v == null)
    throw new Error(msg ?? `Unexpected ${v} value`);
  return v;
}

// node_modules/@rocicorp/zero/out/zero-protocol/src/data.js
var rowSchema = readonlyRecord(valita_exports.union(jsonSchema, valita_exports.undefined()));

// node_modules/@rocicorp/zero/out/zero-protocol/src/ast.js
var SUBQ_PREFIX = "zsubq_";
var selectorSchema = valita_exports.string();
var toStaticParam = Symbol();
var planIdSymbol = Symbol("planId");
var orderingSchema = readonlyArray(readonly(valita_exports.tuple([selectorSchema, literalUnion("asc", "desc")])));
valita_exports.union(valita_exports.string(), valita_exports.number(), valita_exports.boolean(), valita_exports.null());
var equalityOpsSchema = literalUnion("=", "!=", "IS", "IS NOT");
var orderOpsSchema = literalUnion("<", ">", "<=", ">=");
var likeOpsSchema = literalUnion("LIKE", "NOT LIKE", "ILIKE", "NOT ILIKE");
var inOpsSchema = literalUnion("IN", "NOT IN");
var simpleOperatorSchema = valita_exports.union(equalityOpsSchema, orderOpsSchema, likeOpsSchema, inOpsSchema);
var literalReferenceSchema = readonlyObject({
  type: valita_exports.literal("literal"),
  value: valita_exports.union(valita_exports.string(), valita_exports.number(), valita_exports.boolean(), valita_exports.null(), readonlyArray(valita_exports.union(valita_exports.string(), valita_exports.number(), valita_exports.boolean())))
});
var columnReferenceSchema = readonlyObject({
  type: valita_exports.literal("column"),
  name: valita_exports.string()
});
var parameterReferenceSchema = readonlyObject({
  type: valita_exports.literal("static"),
  anchor: literalUnion("authData", "preMutationRow"),
  field: valita_exports.union(valita_exports.string(), valita_exports.array(valita_exports.string()))
});
var conditionValueSchema = valita_exports.union(literalReferenceSchema, columnReferenceSchema, parameterReferenceSchema);
var simpleConditionSchema = readonlyObject({
  type: valita_exports.literal("simple"),
  op: simpleOperatorSchema,
  left: conditionValueSchema,
  right: valita_exports.union(parameterReferenceSchema, literalReferenceSchema)
});
var correlatedSubqueryConditionOperatorSchema = literalUnion("EXISTS", "NOT EXISTS");
var correlatedSubqueryConditionSchema = readonlyObject({
  type: valita_exports.literal("correlatedSubquery"),
  related: valita_exports.lazy(() => correlatedSubquerySchema),
  op: correlatedSubqueryConditionOperatorSchema,
  flip: valita_exports.boolean().optional(),
  scalar: valita_exports.boolean().optional()
});
var conditionSchema = valita_exports.union(simpleConditionSchema, valita_exports.lazy(() => conjunctionSchema), valita_exports.lazy(() => disjunctionSchema), correlatedSubqueryConditionSchema);
var conjunctionSchema = readonlyObject({
  type: valita_exports.literal("and"),
  conditions: readonlyArray(conditionSchema)
});
var disjunctionSchema = readonlyObject({
  type: valita_exports.literal("or"),
  conditions: readonlyArray(conditionSchema)
});
function mustCompoundKey(field) {
  assert(Array.isArray(field) && field.length >= 1, "Expected non-empty array for compound key");
  return field;
}
var compoundKeySchema = readonly(valita_exports.tuple([valita_exports.string()]).concat(valita_exports.array(valita_exports.string())));
var correlatedSubquerySchema = readonlyObject({
  correlation: readonlyObject({
    parentField: compoundKeySchema,
    childField: compoundKeySchema
  }),
  hidden: valita_exports.boolean().optional(),
  system: literalUnion("permissions", "client", "test").optional()
}).extend({ subquery: valita_exports.lazy(() => astSchema) });
var astSchema = readonlyObject({
  schema: valita_exports.string().optional(),
  table: valita_exports.string(),
  alias: valita_exports.string().optional(),
  where: conditionSchema.optional(),
  related: readonlyArray(correlatedSubquerySchema).optional(),
  limit: valita_exports.number().optional(),
  orderBy: orderingSchema.optional(),
  start: valita_exports.object({
    row: rowSchema,
    exclusive: valita_exports.boolean()
  }).optional()
});
function transformAST(ast, transform) {
  const { tableName, columnName } = transform;
  const colName = (c) => columnName(ast.table, c);
  const key = (table, k) => {
    return mustCompoundKey(k.map((col) => columnName(table, col)));
  };
  const where = ast.where ? transform.where(ast.where) : undefined;
  return {
    schema: ast.schema,
    table: tableName(ast.table),
    alias: ast.alias,
    where: where ? transformWhere(where, ast.table, transform) : undefined,
    related: ast.related ? transform.related(ast.related.map((r) => ({
      correlation: {
        parentField: key(ast.table, r.correlation.parentField),
        childField: key(r.subquery.table, r.correlation.childField)
      },
      hidden: r.hidden,
      subquery: transformAST(r.subquery, transform),
      system: r.system
    }))) : undefined,
    start: ast.start ? {
      ...ast.start,
      row: Object.fromEntries(Object.entries(ast.start.row).map(([col, val]) => [colName(col), val]))
    } : undefined,
    limit: ast.limit,
    orderBy: ast.orderBy?.map(([col, dir]) => [colName(col), dir])
  };
}
function transformWhere(where, table, transform) {
  const { columnName } = transform;
  const condValue = (c) => c.type !== "column" ? c : {
    ...c,
    name: columnName(table, c.name)
  };
  const key = (table2, k) => {
    return mustCompoundKey(k.map((col) => columnName(table2, col)));
  };
  if (where.type === "simple")
    return {
      ...where,
      left: condValue(where.left)
    };
  else if (where.type === "correlatedSubquery") {
    const { correlation, subquery } = where.related;
    return {
      ...where,
      related: {
        ...where.related,
        correlation: {
          parentField: key(table, correlation.parentField),
          childField: key(subquery.table, correlation.childField)
        },
        subquery: transformAST(subquery, transform)
      }
    };
  }
  return {
    type: where.type,
    conditions: transform.conditions(where.conditions.map((c) => transformWhere(c, table, transform)))
  };
}
var normalizeCache = /* @__PURE__ */ new WeakMap;
var NORMALIZE_TRANSFORM = {
  tableName: (t) => t,
  columnName: (_, c) => c,
  related: sortedRelated,
  where: flattened,
  conditions: (c) => c.sort(cmpCondition)
};
function normalizeAST(ast) {
  let normalized = normalizeCache.get(ast);
  if (!normalized) {
    normalized = transformAST(ast, NORMALIZE_TRANSFORM);
    normalizeCache.set(ast, normalized);
  }
  return normalized;
}
function mapAST(ast, mapper) {
  return transformAST(ast, {
    tableName: (table) => mapper.tableName(table),
    columnName: (table, col) => mapper.columnName(table, col),
    related: (r) => r,
    where: (w) => w,
    conditions: (c) => c
  });
}
function mapCondition(cond, table, mapper) {
  return transformWhere(cond, table, {
    tableName: (table2) => mapper.tableName(table2),
    columnName: (table2, col) => mapper.columnName(table2, col),
    related: (r) => r,
    where: (w) => w,
    conditions: (c) => c
  });
}
function sortedRelated(related) {
  return related.sort(cmpRelated);
}
function cmpCondition(a, b) {
  if (a.type === "simple") {
    if (b.type !== "simple")
      return -1;
    return compareValuePosition(a.left, b.left) || compareUTF8MaybeNull(a.op, b.op) || compareValuePosition(a.right, b.right);
  }
  if (b.type === "simple")
    return 1;
  if (a.type === "correlatedSubquery") {
    if (b.type !== "correlatedSubquery")
      return -1;
    return cmpRelated(a.related, b.related) || compareUTF8MaybeNull(a.op, b.op) || cmpOptionalBool(a.flip, b.flip) || cmpOptionalBool(a.scalar, b.scalar);
  }
  if (b.type === "correlatedSubquery")
    return -1;
  const val = compareUTF8MaybeNull(a.type, b.type);
  if (val !== 0)
    return val;
  for (let l = 0, r = 0;l < a.conditions.length && r < b.conditions.length; l++, r++) {
    const val2 = cmpCondition(a.conditions[l], b.conditions[r]);
    if (val2 !== 0)
      return val2;
  }
  return a.conditions.length - b.conditions.length;
}
function compareValuePosition(a, b) {
  if (a.type !== b.type)
    return compareUTF8(a.type, b.type);
  switch (a.type) {
    case "literal":
      assert(b.type === "literal", "Expected literal type for comparison");
      return compareUTF8(String(a.value), String(b.value));
    case "column":
      assert(b.type === "column", "Expected column type for comparison");
      return compareUTF8(a.name, b.name);
    case "static":
      throw new Error("Static parameters should be resolved before normalization");
  }
}
function cmpRelated(a, b) {
  return compareUTF8(must(a.subquery.alias), must(b.subquery.alias));
}
function flattened(cond) {
  if (cond.type === "simple" || cond.type === "correlatedSubquery")
    return cond;
  const conditions = defined(cond.conditions.flatMap((c) => c.type === cond.type ? c.conditions.map((c2) => flattened(c2)) : flattened(c)));
  switch (conditions.length) {
    case 0:
      return;
    case 1:
      return conditions[0];
    default:
      return {
        type: cond.type,
        conditions
      };
  }
}
function compareUTF8MaybeNull(a, b) {
  if (a !== null && b !== null)
    return compareUTF8(a, b);
  if (b !== null)
    return -1;
  if (a !== null)
    return 1;
  return 0;
}
function cmpOptionalBool(a, b) {
  const toNum = (v) => v === undefined ? 0 : v ? 2 : 1;
  return toNum(a) - toNum(b);
}

// node_modules/@rocicorp/zero/out/shared/src/tdigest-schema.js
var tdigestSchema = valita_exports.tuple([valita_exports.number()]).concat(valita_exports.array(valita_exports.number()));

// node_modules/@rocicorp/zero/out/zero-protocol/src/analyze-query-result.js
var rowCountsByQuerySchema = valita_exports.record(valita_exports.number());
var rowCountsBySourceSchema = valita_exports.record(rowCountsByQuerySchema);
var rowsByQuerySchema = valita_exports.record(valita_exports.array(rowSchema));
var rowsBySourceSchema = valita_exports.record(rowsByQuerySchema);
var costEstimateJSONSchema = valita_exports.object({
  startupCost: valita_exports.number(),
  scanEst: valita_exports.number(),
  cost: valita_exports.number(),
  returnedRows: valita_exports.number(),
  selectivity: valita_exports.number(),
  limit: valita_exports.number().optional()
});
var plannerConstraintSchema = valita_exports.record(valita_exports.union(valita_exports.unknown(), valita_exports.null()));
var attemptStartEventJSONSchema = valita_exports.object({
  type: valita_exports.literal("attempt-start"),
  attemptNumber: valita_exports.number(),
  totalAttempts: valita_exports.number()
});
var connectionCostsEventJSONSchema = valita_exports.object({
  type: valita_exports.literal("connection-costs"),
  attemptNumber: valita_exports.number(),
  costs: valita_exports.array(valita_exports.object({
    connection: valita_exports.string(),
    cost: valita_exports.number(),
    costEstimate: costEstimateJSONSchema,
    pinned: valita_exports.boolean(),
    constraints: valita_exports.record(valita_exports.union(plannerConstraintSchema, valita_exports.null())),
    constraintCosts: valita_exports.record(costEstimateJSONSchema)
  }))
});
var connectionSelectedEventJSONSchema = valita_exports.object({
  type: valita_exports.literal("connection-selected"),
  attemptNumber: valita_exports.number(),
  connection: valita_exports.string(),
  cost: valita_exports.number(),
  isRoot: valita_exports.boolean()
});
var constraintsPropagatedEventJSONSchema = valita_exports.object({
  type: valita_exports.literal("constraints-propagated"),
  attemptNumber: valita_exports.number(),
  connectionConstraints: valita_exports.array(valita_exports.object({
    connection: valita_exports.string(),
    constraints: valita_exports.record(valita_exports.union(plannerConstraintSchema, valita_exports.null())),
    constraintCosts: valita_exports.record(costEstimateJSONSchema)
  }))
});
var joinTypeSchema = valita_exports.union(valita_exports.literal("semi"), valita_exports.literal("flipped"), valita_exports.literal("unflippable"));
var planCompleteEventJSONSchema = valita_exports.object({
  type: valita_exports.literal("plan-complete"),
  attemptNumber: valita_exports.number(),
  totalCost: valita_exports.number(),
  flipPattern: valita_exports.number(),
  joinStates: valita_exports.array(valita_exports.object({
    join: valita_exports.string(),
    type: joinTypeSchema
  }))
});
var planFailedEventJSONSchema = valita_exports.object({
  type: valita_exports.literal("plan-failed"),
  attemptNumber: valita_exports.number(),
  reason: valita_exports.string()
});
var bestPlanSelectedEventJSONSchema = valita_exports.object({
  type: valita_exports.literal("best-plan-selected"),
  bestAttemptNumber: valita_exports.number(),
  totalCost: valita_exports.number(),
  flipPattern: valita_exports.number(),
  joinStates: valita_exports.array(valita_exports.object({
    join: valita_exports.string(),
    type: joinTypeSchema
  }))
});
var nodeTypeSchema = valita_exports.union(valita_exports.literal("connection"), valita_exports.literal("join"), valita_exports.literal("fan-out"), valita_exports.literal("fan-in"), valita_exports.literal("terminus"));
var nodeCostEventJSONSchema = valita_exports.object({
  type: valita_exports.literal("node-cost"),
  attemptNumber: valita_exports.number().optional(),
  nodeType: nodeTypeSchema,
  node: valita_exports.string(),
  branchPattern: valita_exports.array(valita_exports.number()),
  downstreamChildSelectivity: valita_exports.number(),
  costEstimate: costEstimateJSONSchema,
  filters: conditionSchema.optional(),
  ordering: orderingSchema.optional(),
  joinType: joinTypeSchema.optional()
});
var nodeConstraintEventJSONSchema = valita_exports.object({
  type: valita_exports.literal("node-constraint"),
  attemptNumber: valita_exports.number().optional(),
  nodeType: nodeTypeSchema,
  node: valita_exports.string(),
  branchPattern: valita_exports.array(valita_exports.number()),
  constraint: valita_exports.union(plannerConstraintSchema, valita_exports.null()).optional(),
  from: valita_exports.string()
});
var planDebugEventJSONSchema = valita_exports.union(attemptStartEventJSONSchema, connectionCostsEventJSONSchema, connectionSelectedEventJSONSchema, constraintsPropagatedEventJSONSchema, planCompleteEventJSONSchema, planFailedEventJSONSchema, bestPlanSelectedEventJSONSchema, nodeCostEventJSONSchema, nodeConstraintEventJSONSchema);
var analyzeQueryResultSchema = valita_exports.object({
  warnings: valita_exports.array(valita_exports.string()),
  syncedRows: valita_exports.record(valita_exports.array(rowSchema)).optional(),
  syncedRowCount: valita_exports.number(),
  start: valita_exports.number(),
  end: valita_exports.number(),
  elapsed: valita_exports.number().optional(),
  afterPermissions: valita_exports.string().optional(),
  vendedRowCounts: rowCountsBySourceSchema.optional(),
  vendedRows: rowsBySourceSchema.optional(),
  sqlitePlans: valita_exports.record(valita_exports.array(valita_exports.string())).optional(),
  readRows: rowsBySourceSchema.optional(),
  readRowCountsByQuery: rowCountsBySourceSchema.optional(),
  readRowCount: valita_exports.number().optional(),
  dbScansByQuery: rowCountsBySourceSchema.optional(),
  joinPlans: valita_exports.array(planDebugEventJSONSchema).optional()
});

// node_modules/@rocicorp/zero/out/zero-protocol/src/inspect-down.js
var serverMetricsSchema = valita_exports.object({
  "query-materialization-server": tdigestSchema,
  "query-update-server": tdigestSchema
});
var inspectQueryRowSchema = valita_exports.object({
  clientID: valita_exports.string(),
  queryID: valita_exports.string(),
  ast: astSchema.nullable(),
  name: valita_exports.string().nullable(),
  args: readonlyArray(jsonSchema).nullable(),
  got: valita_exports.boolean(),
  deleted: valita_exports.boolean(),
  ttl: valita_exports.number(),
  inactivatedAt: valita_exports.number().nullable(),
  rowCount: valita_exports.number(),
  metrics: serverMetricsSchema.nullable().optional()
});
var inspectBaseDownSchema = valita_exports.object({ id: valita_exports.string() });
var inspectQueriesDownSchema = inspectBaseDownSchema.extend({
  op: valita_exports.literal("queries"),
  value: valita_exports.array(inspectQueryRowSchema)
});
var inspectMetricsDownSchema = inspectBaseDownSchema.extend({
  op: valita_exports.literal("metrics"),
  value: serverMetricsSchema
});
var inspectVersionDownSchema = inspectBaseDownSchema.extend({
  op: valita_exports.literal("version"),
  value: valita_exports.string()
});
var inspectAuthenticatedDownSchema = inspectBaseDownSchema.extend({
  op: valita_exports.literal("authenticated"),
  value: valita_exports.boolean()
});
var inspectAnalyzeQueryDownSchema = inspectBaseDownSchema.extend({
  op: valita_exports.literal("analyze-query"),
  value: analyzeQueryResultSchema
});
var inspectErrorDownSchema = inspectBaseDownSchema.extend({
  op: valita_exports.literal("error"),
  value: valita_exports.string()
});
var inspectDownBodySchema = valita_exports.union(inspectQueriesDownSchema, inspectMetricsDownSchema, inspectVersionDownSchema, inspectAuthenticatedDownSchema, inspectAnalyzeQueryDownSchema, inspectErrorDownSchema);
var inspectDownMessageSchema = valita_exports.tuple([valita_exports.literal("inspect"), inspectDownBodySchema]);

// node_modules/@rocicorp/zero/out/shared/src/random-values.js
function getNonCryptoRandomValues(array2) {
  if (array2 === null)
    throw new TypeError("array cannot be null");
  for (let i = 0;i < array2.length; i++)
    array2[i] = Math.floor(Math.random() * 256);
  return array2;
}

// node_modules/@rocicorp/zero/out/zero-client/src/util/nanoid.js
function nanoid(size = 21) {
  return getNonCryptoRandomValues(new Uint8Array(size)).reduce((id, byte) => {
    byte &= 63;
    if (byte < 36)
      id += byte.toString(36);
    else if (byte < 62)
      id += (byte - 26).toString(36).toUpperCase();
    else if (byte > 62)
      id += "-";
    else
      id += "_";
    return id;
  }, "");
}

// node_modules/js-xxhash/dist/esm/xxHash32.js
var PRIME32_1 = 2654435761;
var PRIME32_2 = 2246822519;
var PRIME32_3 = 3266489917;
var PRIME32_4 = 668265263;
var PRIME32_5 = 374761393;
var encoder;
function xxHash32(input, seed = 0) {
  const buffer = typeof input === "string" ? (encoder ??= new TextEncoder).encode(input) : input;
  const b = buffer;
  let acc = seed + PRIME32_5 & 4294967295;
  let offset = 0;
  if (b.length >= 16) {
    const accN = [
      seed + PRIME32_1 + PRIME32_2 & 4294967295,
      seed + PRIME32_2 & 4294967295,
      seed + 0 & 4294967295,
      seed - PRIME32_1 & 4294967295
    ];
    const b2 = buffer;
    const limit2 = b2.length - 16;
    let lane = 0;
    for (offset = 0;(offset & 4294967280) <= limit2; offset += 4) {
      const i = offset;
      const laneN0 = b2[i + 0] + (b2[i + 1] << 8);
      const laneN1 = b2[i + 2] + (b2[i + 3] << 8);
      const laneNP = laneN0 * PRIME32_2 + (laneN1 * PRIME32_2 << 16);
      let acc2 = accN[lane] + laneNP & 4294967295;
      acc2 = acc2 << 13 | acc2 >>> 19;
      const acc0 = acc2 & 65535;
      const acc1 = acc2 >>> 16;
      accN[lane] = acc0 * PRIME32_1 + (acc1 * PRIME32_1 << 16) & 4294967295;
      lane = lane + 1 & 3;
    }
    acc = (accN[0] << 1 | accN[0] >>> 31) + (accN[1] << 7 | accN[1] >>> 25) + (accN[2] << 12 | accN[2] >>> 20) + (accN[3] << 18 | accN[3] >>> 14) & 4294967295;
  }
  acc = acc + buffer.length & 4294967295;
  const limit = buffer.length - 4;
  for (;offset <= limit; offset += 4) {
    const i = offset;
    const laneN0 = b[i + 0] + (b[i + 1] << 8);
    const laneN1 = b[i + 2] + (b[i + 3] << 8);
    const laneP = laneN0 * PRIME32_3 + (laneN1 * PRIME32_3 << 16);
    acc = acc + laneP & 4294967295;
    acc = acc << 17 | acc >>> 15;
    acc = (acc & 65535) * PRIME32_4 + ((acc >>> 16) * PRIME32_4 << 16) & 4294967295;
  }
  for (;offset < b.length; ++offset) {
    const lane = b[offset];
    acc = acc + lane * PRIME32_5;
    acc = acc << 11 | acc >>> 21;
    acc = (acc & 65535) * PRIME32_1 + ((acc >>> 16) * PRIME32_1 << 16) & 4294967295;
  }
  acc = acc ^ acc >>> 15;
  acc = ((acc & 65535) * PRIME32_2 & 4294967295) + ((acc >>> 16) * PRIME32_2 << 16);
  acc = acc ^ acc >>> 13;
  acc = ((acc & 65535) * PRIME32_3 & 4294967295) + ((acc >>> 16) * PRIME32_3 << 16);
  acc = acc ^ acc >>> 16;
  return acc < 0 ? acc + 4294967296 : acc;
}
// node_modules/@rocicorp/zero/out/shared/src/hash.js
var h64 = (s) => hash(s, 2);
var h128 = (s) => hash(s, 4);
function hash(str, words) {
  let hash2 = 0n;
  for (let i = 0;i < words; i++)
    hash2 = (hash2 << 32n) + BigInt(xxHash32(str, i));
  return hash2;
}

// node_modules/@rocicorp/zero/out/zero-protocol/src/primary-key.js
var primaryKeySchema = readonly(valita_exports.tuple([valita_exports.string()]).concat(valita_exports.array(valita_exports.string())));
var primaryKeyValueSchema = valita_exports.union(valita_exports.string(), valita_exports.number(), valita_exports.boolean());
var primaryKeyValueRecordSchema = readonlyRecord(primaryKeyValueSchema);

// node_modules/@rocicorp/zero/out/zero-client/src/client/keys.js
function toDesiredQueriesKey(clientID, hash2) {
  return "d/" + clientID + "/" + hash2;
}
function desiredQueriesPrefixForClient(clientID) {
  return "d/" + clientID + "/";
}
function toGotQueriesKey(hash2) {
  return "g/" + hash2;
}
function toMutationResponseKey(mid) {
  return "m/" + mid.clientID + "/" + mid.id;
}
function toPrimaryKeyString(tableName, primaryKey, value) {
  if (primaryKey.length === 1)
    return "e/" + tableName + "/" + parse(value[primaryKey[0]], primaryKeyValueSchema);
  const values = primaryKey.map((k) => parse(value[k], primaryKeyValueSchema));
  const idSegment = h128(JSON.stringify(values));
  return "e/" + tableName + "/" + idSegment;
}
function sourceNameFromKey(key) {
  const slash = key.indexOf("/", 2);
  return key.slice(2, slash);
}

// node_modules/@rocicorp/zero/out/zero-client/src/client/inspector/client-group.js
var ClientGroup = class {
  #delegate;
  id;
  constructor(delegate, clientGroupID) {
    this.#delegate = delegate;
    this.id = clientGroupID;
  }
  async clients() {
    return (await this.#delegate.lazy).clientGroupClients(this.#delegate, this.id);
  }
  async clientsWithQueries() {
    return (await this.#delegate.lazy).clientGroupClientsWithQueries(this.#delegate, this.id);
  }
  async queries() {
    return (await this.#delegate.lazy).clientGroupQueries(this.#delegate);
  }
};

// node_modules/@rocicorp/zero/out/zero-client/src/client/inspector/client.js
var Client = class {
  #delegate;
  id;
  clientGroup;
  constructor(delegate, clientID, clientGroupID) {
    this.#delegate = delegate;
    this.id = clientID;
    this.clientGroup = new ClientGroup(this.#delegate, clientGroupID);
  }
  async queries() {
    return (await this.#delegate.lazy).clientQueries(this.#delegate, this.id);
  }
  async map() {
    return (await this.#delegate.lazy).clientMap(this.#delegate, this.id);
  }
  async rows(tableName) {
    return (await this.#delegate.lazy).clientRows(this.#delegate, this.id, tableName);
  }
};

// node_modules/@rocicorp/zero/out/shared/src/centroid.js
var Centroid = class {
  mean;
  weight;
  constructor(mean, weight) {
    this.mean = mean;
    this.weight = weight;
  }
  add(r) {
    if (r.weight < 0)
      throw new Error("centroid weight cannot be less than zero");
    if (this.weight !== 0) {
      this.weight += r.weight;
      this.mean += r.weight * (r.mean - this.mean) / this.weight;
    } else {
      this.weight = r.weight;
      this.mean = r.mean;
    }
  }
};
function sortCentroidList(centroids) {
  centroids.sort((a, b) => a.mean - b.mean);
}

// node_modules/@rocicorp/zero/out/shared/src/tdigest.js
var TDigest = class TDigest2 {
  compression;
  #maxProcessed;
  #maxUnprocessed;
  #processed;
  #unprocessed;
  #cumulative;
  #processedWeight;
  #unprocessedWeight;
  #min;
  #max;
  constructor(compression = 1000) {
    this.compression = compression;
    this.#maxProcessed = processedSize(0, this.compression);
    this.#maxUnprocessed = unprocessedSize(0, this.compression);
    this.reset();
  }
  static fromJSON(data) {
    const digest = new TDigest2(data[0]);
    if (data.length % 2 !== 1)
      throw new Error("Invalid centroids array");
    for (let i = 1;i < data.length; i += 2)
      digest.add(data[i], data[i + 1]);
    return digest;
  }
  reset() {
    this.#processed = [];
    this.#unprocessed = [];
    this.#cumulative = [];
    this.#processedWeight = 0;
    this.#unprocessedWeight = 0;
    this.#min = Number.MAX_VALUE;
    this.#max = -Number.MAX_VALUE;
  }
  add(mean, weight = 1) {
    this.addCentroid(new Centroid(mean, weight));
  }
  addCentroidList(centroidList) {
    for (const c of centroidList)
      this.addCentroid(c);
  }
  addCentroid(c) {
    if (Number.isNaN(c.mean) || c.weight <= 0 || Number.isNaN(c.weight) || !Number.isFinite(c.weight))
      return;
    this.#unprocessed.push(new Centroid(c.mean, c.weight));
    this.#unprocessedWeight += c.weight;
    if (this.#processed.length > this.#maxProcessed || this.#unprocessed.length > this.#maxUnprocessed)
      this.#process();
  }
  merge(t2) {
    t2.#process();
    this.addCentroidList(t2.#processed);
  }
  #process() {
    if (this.#unprocessed.length > 0 || this.#processed.length > this.#maxProcessed) {
      this.#unprocessed.push(...this.#processed);
      sortCentroidList(this.#unprocessed);
      this.#processed.length = 0;
      this.#processed.push(this.#unprocessed[0]);
      this.#processedWeight += this.#unprocessedWeight;
      this.#unprocessedWeight = 0;
      let soFar = this.#unprocessed[0].weight;
      let limit = this.#processedWeight * this.#integratedQ(1);
      for (let i = 1;i < this.#unprocessed.length; i++) {
        const centroid = this.#unprocessed[i];
        const projected = soFar + centroid.weight;
        if (projected <= limit) {
          soFar = projected;
          this.#processed[this.#processed.length - 1].add(centroid);
        } else {
          const k1 = this.#integratedLocation(soFar / this.#processedWeight);
          limit = this.#processedWeight * this.#integratedQ(k1 + 1);
          soFar += centroid.weight;
          this.#processed.push(centroid);
        }
      }
      this.#min = Math.min(this.#min, this.#processed[0].mean);
      this.#max = Math.max(this.#max, this.#processed[this.#processed.length - 1].mean);
      this.#unprocessed.length = 0;
    }
  }
  centroids(cl = []) {
    this.#process();
    return cl.concat(this.#processed);
  }
  count() {
    this.#process();
    return this.#processedWeight;
  }
  toJSON() {
    this.#process();
    const data = [this.compression];
    for (const centroid of this.#processed)
      data.push(centroid.mean, centroid.weight);
    return data;
  }
  #updateCumulative() {
    if (this.#cumulative.length > 0 && this.#cumulative[this.#cumulative.length - 1] === this.#processedWeight)
      return;
    const n = this.#processed.length + 1;
    if (this.#cumulative.length > n)
      this.#cumulative.length = n;
    let prev = 0;
    for (let i = 0;i < this.#processed.length; i++) {
      const cur = this.#processed[i].weight;
      this.#cumulative[i] = prev + cur / 2;
      prev += cur;
    }
    this.#cumulative[this.#processed.length] = prev;
  }
  quantile(q) {
    this.#process();
    this.#updateCumulative();
    if (q < 0 || q > 1 || this.#processed.length === 0)
      return NaN;
    if (this.#processed.length === 1)
      return this.#processed[0].mean;
    const index = q * this.#processedWeight;
    if (index <= this.#processed[0].weight / 2)
      return this.#min + 2 * index / this.#processed[0].weight * (this.#processed[0].mean - this.#min);
    const lower = binarySearch(this.#cumulative.length, (i) => -this.#cumulative[i] + index);
    if (lower + 1 !== this.#cumulative.length) {
      const z12 = index - this.#cumulative[lower - 1];
      const z22 = this.#cumulative[lower] - index;
      return weightedAverage(this.#processed[lower - 1].mean, z22, this.#processed[lower].mean, z12);
    }
    const z1 = index - this.#processedWeight - this.#processed[lower - 1].weight / 2;
    const z2 = this.#processed[lower - 1].weight / 2 - z1;
    return weightedAverage(this.#processed[this.#processed.length - 1].mean, z1, this.#max, z2);
  }
  cdf(x) {
    this.#process();
    this.#updateCumulative();
    switch (this.#processed.length) {
      case 0:
        return 0;
      case 1: {
        const width = this.#max - this.#min;
        if (x <= this.#min)
          return 0;
        if (x >= this.#max)
          return 1;
        if (x - this.#min <= width)
          return 0.5;
        return (x - this.#min) / width;
      }
    }
    if (x <= this.#min)
      return 0;
    if (x >= this.#max)
      return 1;
    const m0 = this.#processed[0].mean;
    if (x <= m0) {
      if (m0 - this.#min > 0)
        return (x - this.#min) / (m0 - this.#min) * this.#processed[0].weight / this.#processedWeight / 2;
      return 0;
    }
    const mn = this.#processed[this.#processed.length - 1].mean;
    if (x >= mn) {
      if (this.#max - mn > 0)
        return 1 - (this.#max - x) / (this.#max - mn) * this.#processed[this.#processed.length - 1].weight / this.#processedWeight / 2;
      return 1;
    }
    const upper = binarySearch(this.#processed.length, (i) => x - this.#processed[i].mean || 1);
    const z1 = x - this.#processed[upper - 1].mean;
    const z2 = this.#processed[upper].mean - x;
    return weightedAverage(this.#cumulative[upper - 1], z2, this.#cumulative[upper], z1) / this.#processedWeight;
  }
  #integratedQ(k) {
    return (Math.sin(Math.min(k, this.compression) * Math.PI / this.compression - Math.PI / 2) + 1) / 2;
  }
  #integratedLocation(q) {
    return this.compression * (Math.asin(2 * q - 1) + Math.PI / 2) / Math.PI;
  }
};
function weightedAverage(x1, w1, x2, w2) {
  if (x1 <= x2)
    return weightedAverageSorted(x1, w1, x2, w2);
  return weightedAverageSorted(x2, w2, x1, w1);
}
function weightedAverageSorted(x1, w1, x2, w2) {
  const x = (x1 * w1 + x2 * w2) / (w1 + w2);
  return Math.max(x1, Math.min(x, x2));
}
function processedSize(size, compression) {
  if (size === 0)
    return Math.ceil(compression) * 2;
  return size;
}
function unprocessedSize(size, compression) {
  if (size === 0)
    return Math.ceil(compression) * 8;
  return size;
}

// node_modules/@rocicorp/zero/out/zql/src/planner/planner-debug.js
function formatConstraint(constraint) {
  if (!constraint)
    return "{}";
  const keys = Object.keys(constraint);
  if (keys.length === 0)
    return "{}";
  return "{" + keys.join(", ") + "}";
}
function formatValuePosition(value) {
  switch (value.type) {
    case "column":
      return value.name;
    case "literal":
      if (typeof value.value === "string")
        return `'${value.value}'`;
      return JSON.stringify(value.value);
    case "static":
      return `@${value.anchor}.${Array.isArray(value.field) ? value.field.join(".") : value.field}`;
  }
}
function formatFilter(filter) {
  if (!filter)
    return "none";
  switch (filter.type) {
    case "simple":
      return `${formatValuePosition(filter.left)} ${filter.op} ${formatValuePosition(filter.right)}`;
    case "and":
      return `(${filter.conditions.map(formatFilter).join(" AND ")})`;
    case "or":
      return `(${filter.conditions.map(formatFilter).join(" OR ")})`;
    case "correlatedSubquery":
      return `EXISTS(${filter.related.subquery.table})`;
    default:
      return JSON.stringify(filter);
  }
}
function formatOrdering(ordering) {
  if (!ordering || ordering.length === 0)
    return "none";
  return ordering.map(([field, direction]) => `${field} ${direction}`).join(", ");
}
function formatAttemptSummary(attemptNum, events) {
  const lines = [];
  const totalAttempts = events.find((e) => e.type === "attempt-start")?.totalAttempts ?? "?";
  const numBits = typeof totalAttempts === "number" ? Math.ceil(Math.log2(totalAttempts)) || 1 : 1;
  const bitPattern = attemptNum.toString(2).padStart(numBits, "0");
  lines.push(`[Attempt ${attemptNum + 1}/${totalAttempts}] Pattern ${attemptNum} (${bitPattern})`);
  const connectionCostEvents = [];
  const connectionConstraintEvents = [];
  for (const event of events) {
    if (event.type === "node-cost" && event.nodeType === "connection")
      connectionCostEvents.push(event);
    if (event.type === "node-constraint" && event.nodeType === "connection")
      connectionConstraintEvents.push(event);
  }
  if (connectionCostEvents.length > 0) {
    lines.push("  Connections:");
    for (const cost of connectionCostEvents) {
      const constraint = connectionConstraintEvents.find((c) => c.node === cost.node && c.branchPattern.join(",") === cost.branchPattern.join(","))?.constraint;
      const constraintStr = formatConstraint(constraint);
      const filterStr = formatFilter(cost.filters);
      const orderingStr = formatOrdering(cost.ordering);
      const limitStr = cost.costEstimate.limit !== undefined ? cost.costEstimate.limit.toString() : "none";
      lines.push(`    ${cost.node}:`);
      lines.push(`      cost=${cost.costEstimate.cost.toFixed(2)}, startup=${cost.costEstimate.startupCost.toFixed(2)}, scan=${cost.costEstimate.scanEst.toFixed(2)}`);
      lines.push(`      rows=${cost.costEstimate.returnedRows.toFixed(2)}, selectivity=${cost.costEstimate.selectivity.toFixed(8)}, limit=${limitStr}`);
      lines.push(`      downstreamChildSelectivity=${cost.downstreamChildSelectivity.toFixed(8)}`);
      lines.push(`      constraints=${constraintStr}`);
      lines.push(`      filters=${filterStr}`);
      lines.push(`      ordering=${orderingStr}`);
    }
  }
  const joinCosts = [];
  for (const event of events)
    if (event.type === "node-cost" && event.nodeType === "join")
      joinCosts.push(event);
  if (joinCosts.length > 0) {
    lines.push("  Joins:");
    for (const cost of joinCosts) {
      const typeStr = cost.joinType ? ` (${cost.joinType})` : "";
      const limitStr = cost.costEstimate.limit !== undefined ? cost.costEstimate.limit.toString() : "none";
      lines.push(`    ${cost.node}${typeStr}:`);
      lines.push(`      cost=${cost.costEstimate.cost.toFixed(2)}, startup=${cost.costEstimate.startupCost.toFixed(2)}, scan=${cost.costEstimate.scanEst.toFixed(2)}`);
      lines.push(`      rows=${cost.costEstimate.returnedRows.toFixed(2)}, selectivity=${cost.costEstimate.selectivity.toFixed(8)}, limit=${limitStr}`);
      lines.push(`      downstreamChildSelectivity=${cost.downstreamChildSelectivity.toFixed(8)}`);
    }
  }
  const completeEvent = events.find((e) => e.type === "plan-complete");
  const failedEvent = events.find((e) => e.type === "plan-failed");
  if (completeEvent)
    lines.push(`  ✓ Plan complete: total cost = ${completeEvent.totalCost.toFixed(2)}`);
  else if (failedEvent)
    lines.push(`  ✗ Plan failed: ${failedEvent.reason}`);
  return lines;
}
function formatPlannerEvents(events) {
  const lines = [];
  const eventsByAttempt = /* @__PURE__ */ new Map;
  let bestPlanEvent;
  for (const event of events)
    if ("attemptNumber" in event) {
      const attempt = event.attemptNumber;
      if (attempt !== undefined) {
        let attemptEvents = eventsByAttempt.get(attempt);
        if (!attemptEvents) {
          attemptEvents = [];
          eventsByAttempt.set(attempt, attemptEvents);
        }
        attemptEvents.push(event);
      }
    } else if (event.type === "best-plan-selected")
      bestPlanEvent = event;
  for (const [attemptNum, events2] of eventsByAttempt.entries()) {
    lines.push(...formatAttemptSummary(attemptNum, events2));
    lines.push("");
  }
  if (bestPlanEvent) {
    lines.push("─".repeat(60));
    lines.push(`✓ Best plan: Attempt ${bestPlanEvent.bestAttemptNumber + 1} (cost=${bestPlanEvent.totalCost.toFixed(2)})`);
    if (bestPlanEvent.joinStates.length > 0) {
      lines.push("  Join types:");
      for (const j of bestPlanEvent.joinStates)
        lines.push(`    ${j.join}: ${j.type}`);
    }
    lines.push("─".repeat(60));
  }
  return lines.join(`
`);
}

// node_modules/@rocicorp/zero/out/zero-client/src/client/inspector/inspector.js
var Inspector = class {
  #delegate;
  client;
  clientGroup;
  constructor(rep, inspectorDelegate, queryDelegate, getSocket) {
    this.#delegate = {
      getQueryMetrics: inspectorDelegate.getQueryMetrics.bind(inspectorDelegate),
      getAST: inspectorDelegate.getAST.bind(inspectorDelegate),
      mapClientASTToServer: inspectorDelegate.mapClientASTToServer.bind(inspectorDelegate),
      get metrics() {
        return inspectorDelegate.metrics;
      },
      queryDelegate,
      rep,
      getSocket,
      lazy: import("./chunk-qy11ywkd.js")
    };
    this.client = new Client(this.#delegate, rep.clientID, rep.clientGroupID);
    this.clientGroup = this.client.clientGroup;
  }
  async metrics() {
    return (await this.#delegate.lazy).inspectorMetrics(this.#delegate);
  }
  async clients() {
    return (await this.#delegate.lazy).inspectorClients(this.#delegate);
  }
  async clientsWithQueries() {
    return (await this.#delegate.lazy).inspectorClientsWithQueries(this.#delegate);
  }
  async serverVersion() {
    return (await this.#delegate.lazy).serverVersion(this.#delegate);
  }
  async analyzeQuery(query, options) {
    return (await this.#delegate.lazy).analyzeQuery(this.#delegate, query, options);
  }
  formatPlannerEvents(events) {
    return formatPlannerEvents(events);
  }
};

// node_modules/@rocicorp/zero/out/zql/src/query/ttl.js
var DEFAULT_TTL_MS = 1000 * 60 * 5;
var MAX_TTL_MS = 1000 * 60 * 10;
var multiplier = {
  s: 1000,
  m: 60 * 1000,
  h: 3600 * 1000,
  d: 1440 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000
};
function parseTTL(ttl) {
  if (typeof ttl === "number")
    return Number.isNaN(ttl) ? 0 : !Number.isFinite(ttl) || ttl < 0 ? -1 : ttl;
  if (ttl === "none")
    return 0;
  if (ttl === "forever")
    return -1;
  const multi = multiplier[ttl[ttl.length - 1]];
  return Number(ttl.slice(0, -1)) * multi;
}
function compareTTL(a, b) {
  const ap = parseTTL(a);
  const bp = parseTTL(b);
  if (ap === -1 && bp !== -1)
    return 1;
  if (ap !== -1 && bp === -1)
    return -1;
  return ap - bp;
}
function normalizeTTL(ttl) {
  if (typeof ttl === "string")
    return ttl;
  if (ttl < 0)
    return "forever";
  if (ttl === 0)
    return "none";
  let shortest = ttl.toString();
  const lengthOfNumber = shortest.length;
  for (const unit of [
    "y",
    "d",
    "h",
    "m",
    "s"
  ]) {
    const candidate = `${ttl / multiplier[unit]}${unit}`;
    if (candidate.length < shortest.length)
      shortest = candidate;
  }
  return shortest.length < lengthOfNumber ? shortest : ttl;
}
function clampTTL(ttl, lc) {
  const parsedTTL = parseTTL(ttl);
  if (parsedTTL === -1 || parsedTTL > 600 * 1000) {
    lc?.warn?.(`TTL (${ttl}) is too high, clamping to 10m`);
    return parseTTL("10m");
  }
  return parsedTTL;
}

export { __toESM, __commonJS, __export, stringCompare, assert, assertString, assertNumber, assertBoolean, assertObject, assertArray, assertNotNull, unreachable, resolver, __exportAll, valita_exports, parse, test, readonly, readonlyObject, readonlyArray, literalUnion, isProd, hasOwn, deepFreeze, deepFreezeAllowUndefined, clientGroupIDSchema, clientIDSchema, deepEqual, assertJSONValue, assertJSONObject, compareCookies, assertCookie, emptyHash, newRandomHash, assertHash, Chunk, assertRefs, createChunk, binarySearch, joinIterables, once, wrapIterable, compareUTF8, greaterThan, lessThan, lessThanEq, getSizeOfValue, BTreeRead, ChunkNotFoundError, mustGetChunk, mustGetHeadHash, DEFAULT_HEAD_NAME, commitIsLocalDD31, localMutations, localMutationsDD31, localMutationsGreaterThan, baseSnapshotFromHead, baseSnapshotFromHash, baseSnapshotFromCommit, snapshotMetaParts, compareCookiesForSnapshots, commitFromHash, commitFromHead, assertLocalMetaDD31, isLocalMetaDD31, assertSnapshotMetaDD31, assertSnapshotCommitDD31, asyncIterableToArray, diff, Lock, RWLock, encodeIndexScanKey, decodeIndexKey, readFromDefaultHead, readFromHash, DiffsMap, diff2 as diff1, diffCommits, addDiffsForIndexes, newWriteLocal, newWriteSnapshotDD31, withRead, withWriteNoImplicitCommit, withWrite, using, getClientGroups, setClientGroups, setClientGroup, getClientGroup, clientGroupHasPendingMutations, disableClientGroup, makeClientID, assertClientV6, getClients, ClientStateNotFoundError, assertHasClientState, hasClientState, getClient, mustGetClient, initClientV6, getClientGroupForClient, getClientGroupIDForClient, setClient, setClients, jsonSchema, jsonObjectSchema, must, h64, mapValues, mapEntries, mapAllEntries, areEqual, rowSchema, SUBQ_PREFIX, toStaticParam, planIdSymbol, astSchema, normalizeAST, mapAST, mapCondition, queryInternalsTag, asQueryInternals, getNonCryptoRandomValues, primaryKeySchema, primaryKeyValueRecordSchema, inspectQueriesDownSchema, inspectMetricsDownSchema, inspectVersionDownSchema, inspectAuthenticatedDownSchema, inspectAnalyzeQueryDownSchema, inspectDownMessageSchema, nanoid, toDesiredQueriesKey, desiredQueriesPrefixForClient, toGotQueriesKey, toMutationResponseKey, toPrimaryKeyString, sourceNameFromKey, DEFAULT_TTL_MS, compareTTL, normalizeTTL, clampTTL, Client, TDigest, Inspector };

//# debugId=ECF6A434A84785D364756E2164756E21
