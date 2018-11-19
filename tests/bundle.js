var Neutral = (function (exports) {
	'use strict';

	var strictUriEncode = str => encodeURIComponent(str).replace(/[!'()*]/g, x => `%${x.charCodeAt(0).toString(16).toUpperCase()}`);

	var token = '%[a-f0-9]{2}';
	var singleMatcher = new RegExp(token, 'gi');
	var multiMatcher = new RegExp('(' + token + ')+', 'gi');

	function decodeComponents(components, split) {
		try {
			// Try to decode the entire string first
			return decodeURIComponent(components.join(''));
		} catch (err) {
			// Do nothing
		}

		if (components.length === 1) {
			return components;
		}

		split = split || 1;

		// Split the array in 2 parts
		var left = components.slice(0, split);
		var right = components.slice(split);

		return Array.prototype.concat.call([], decodeComponents(left), decodeComponents(right));
	}

	function decode(input) {
		try {
			return decodeURIComponent(input);
		} catch (err) {
			var tokens = input.match(singleMatcher);

			for (var i = 1; i < tokens.length; i++) {
				input = decodeComponents(tokens, i).join('');

				tokens = input.match(singleMatcher);
			}

			return input;
		}
	}

	function customDecodeURIComponent(input) {
		// Keep track of all the replacements and prefill the map with the `BOM`
		var replaceMap = {
			'%FE%FF': '\uFFFD\uFFFD',
			'%FF%FE': '\uFFFD\uFFFD'
		};

		var match = multiMatcher.exec(input);
		while (match) {
			try {
				// Decode as big chunks as possible
				replaceMap[match[0]] = decodeURIComponent(match[0]);
			} catch (err) {
				var result = decode(match[0]);

				if (result !== match[0]) {
					replaceMap[match[0]] = result;
				}
			}

			match = multiMatcher.exec(input);
		}

		// Add `%C2` at the end of the map to make sure it does not replace the combinator before everything else
		replaceMap['%C2'] = '\uFFFD';

		var entries = Object.keys(replaceMap);

		for (var i = 0; i < entries.length; i++) {
			// Replace all decoded components
			var key = entries[i];
			input = input.replace(new RegExp(key, 'g'), replaceMap[key]);
		}

		return input;
	}

	var decodeUriComponent = function (encodedURI) {
		if (typeof encodedURI !== 'string') {
			throw new TypeError('Expected `encodedURI` to be of type `string`, got `' + typeof encodedURI + '`');
		}

		try {
			encodedURI = encodedURI.replace(/\+/g, ' ');

			// Try the built in decoder first
			return decodeURIComponent(encodedURI);
		} catch (err) {
			// Fallback to a more advanced decoder
			return customDecodeURIComponent(encodedURI);
		}
	};

	function encoderForArrayFormat(options) {
		switch (options.arrayFormat) {
			case 'index':
				return (key, value, index) => {
					return value === null ? [
						encode(key, options),
						'[',
						index,
						']'
					].join('') : [
						encode(key, options),
						'[',
						encode(index, options),
						']=',
						encode(value, options)
					].join('');
				};
			case 'bracket':
				return (key, value) => {
					return value === null ? [encode(key, options), '[]'].join('') : [
						encode(key, options),
						'[]=',
						encode(value, options)
					].join('');
				};
			default:
				return (key, value) => {
					return value === null ? encode(key, options) : [
						encode(key, options),
						'=',
						encode(value, options)
					].join('');
				};
		}
	}

	function parserForArrayFormat(options) {
		let result;

		switch (options.arrayFormat) {
			case 'index':
				return (key, value, accumulator) => {
					result = /\[(\d*)\]$/.exec(key);

					key = key.replace(/\[\d*\]$/, '');

					if (!result) {
						accumulator[key] = value;
						return;
					}

					if (accumulator[key] === undefined) {
						accumulator[key] = {};
					}

					accumulator[key][result[1]] = value;
				};
			case 'bracket':
				return (key, value, accumulator) => {
					result = /(\[\])$/.exec(key);
					key = key.replace(/\[\]$/, '');

					if (!result) {
						accumulator[key] = value;
						return;
					}

					if (accumulator[key] === undefined) {
						accumulator[key] = [value];
						return;
					}

					accumulator[key] = [].concat(accumulator[key], value);
				};
			default:
				return (key, value, accumulator) => {
					if (accumulator[key] === undefined) {
						accumulator[key] = value;
						return;
					}

					accumulator[key] = [].concat(accumulator[key], value);
				};
		}
	}

	function encode(value, options) {
		if (options.encode) {
			return options.strict ? strictUriEncode(value) : encodeURIComponent(value);
		}

		return value;
	}

	function decode$1(value, options) {
		if (options.decode) {
			return decodeUriComponent(value);
		}

		return value;
	}

	function keysSorter(input) {
		if (Array.isArray(input)) {
			return input.sort();
		}

		if (typeof input === 'object') {
			return keysSorter(Object.keys(input))
				.sort((a, b) => Number(a) - Number(b))
				.map(key => input[key]);
		}

		return input;
	}

	function parse(input, options) {
		options = Object.assign({decode: true, arrayFormat: 'none'}, options);

		const formatter = parserForArrayFormat(options);

		// Create an object with no prototype
		const ret = Object.create(null);

		if (typeof input !== 'string') {
			return ret;
		}

		input = input.trim().replace(/^[?#&]/, '');

		if (!input) {
			return ret;
		}

		for (const param of input.split('&')) {
			let [key, value] = param.replace(/\+/g, ' ').split('=');

			// Missing `=` should be `null`:
			// http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
			value = value === undefined ? null : decode$1(value, options);

			formatter(decode$1(key, options), value, ret);
		}

		return Object.keys(ret).sort().reduce((result, key) => {
			const value = ret[key];
			if (Boolean(value) && typeof value === 'object' && !Array.isArray(value)) {
				// Sort object keys, not values
				result[key] = keysSorter(value);
			} else {
				result[key] = value;
			}

			return result;
		}, Object.create(null));
	}
	var parse_1 = parse;

	var stringify = (obj, options) => {
		if (!obj) {
			return '';
		}

		options = Object.assign({
			encode: true,
			strict: true,
			arrayFormat: 'none'
		}, options);

		const formatter = encoderForArrayFormat(options);
		const keys = Object.keys(obj);

		if (options.sort !== false) {
			keys.sort(options.sort);
		}

		return keys.map(key => {
			const value = obj[key];

			if (value === undefined) {
				return '';
			}

			if (value === null) {
				return encode(key, options);
			}

			if (Array.isArray(value)) {
				const result = [];

				for (const value2 of value.slice()) {
					if (value2 === undefined) {
						continue;
					}

					result.push(formatter(key, value2, result.length));
				}

				return result.join('&');
			}

			return encode(key, options) + '=' + encode(value, options);
		}).filter(x => x.length > 0).join('&');
	};

	var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var core = createCommonjsModule(function (module) {
	(function() {
	  var URL, URL_PATTERN, defaults, urllite,
	    __hasProp = {}.hasOwnProperty;

	  URL_PATTERN = /^(?:(?:([^:\/?\#]+:)\/+|(\/\/))(?:([a-z0-9-\._~%]+)(?::([a-z0-9-\._~%]+))?@)?(([a-z0-9-\._~%!$&'()*+,;=]+)(?::([0-9]+))?)?)?([^?\#]*?)(\?[^\#]*)?(\#.*)?$/;

	  urllite = function(raw, opts) {
	    return urllite.URL.parse(raw, opts);
	  };

	  urllite.URL = URL = (function() {
	    function URL(props) {
	      var k, v, _ref;
	      for (k in defaults) {
	        if (!__hasProp.call(defaults, k)) continue;
	        v = defaults[k];
	        this[k] = (_ref = props[k]) != null ? _ref : v;
	      }
	      this.host || (this.host = this.hostname && this.port ? "" + this.hostname + ":" + this.port : this.hostname ? this.hostname : '');
	      this.origin || (this.origin = this.protocol ? "" + this.protocol + "//" + this.host : '');
	      this.isAbsolutePathRelative = !this.host && this.pathname.charAt(0) === '/';
	      this.isPathRelative = !this.host && this.pathname.charAt(0) !== '/';
	      this.isRelative = this.isSchemeRelative || this.isAbsolutePathRelative || this.isPathRelative;
	      this.isAbsolute = !this.isRelative;
	    }

	    URL.parse = function(raw) {
	      var m, pathname, protocol;
	      m = raw.toString().match(URL_PATTERN);
	      pathname = m[8] || '';
	      protocol = m[1];
	      return new urllite.URL({
	        protocol: protocol,
	        username: m[3],
	        password: m[4],
	        hostname: m[6],
	        port: m[7],
	        pathname: protocol && pathname.charAt(0) !== '/' ? "/" + pathname : pathname,
	        search: m[9],
	        hash: m[10],
	        isSchemeRelative: m[2] != null
	      });
	    };

	    return URL;

	  })();

	  defaults = {
	    protocol: '',
	    username: '',
	    password: '',
	    host: '',
	    hostname: '',
	    port: '',
	    pathname: '',
	    search: '',
	    hash: '',
	    origin: '',
	    isSchemeRelative: false
	  };

	  module.exports = urllite;

	}).call(commonjsGlobal);
	});

	var immutable = extend;

	var hasOwnProperty = Object.prototype.hasOwnProperty;

	function extend() {
	    var target = {};

	    for (var i = 0; i < arguments.length; i++) {
	        var source = arguments[i];

	        for (var key in source) {
	            if (hasOwnProperty.call(source, key)) {
	                target[key] = source[key];
	            }
	        }
	    }

	    return target
	}

	(function() {
	  var URL, extend, urllite;

	  urllite = core;

	  URL = urllite.URL;

	  extend = immutable;

	  URL.prototype.normalize = function() {
	    var m, pathname;
	    pathname = this.pathname;
	    while (m = /^(.*?)[^\/]+\/\.\.\/*(.*)$/.exec(pathname)) {
	      pathname = "" + m[1] + m[2];
	    }
	    if (this.host && pathname.indexOf('..') !== -1) {
	      throw new Error('Path is behind root.');
	    }
	    return new urllite.URL(extend(this, {
	      pathname: pathname
	    }));
	  };

	}).call(commonjsGlobal);

	(function() {
	  var URL, copyProps, oldParse, urllite,
	    __slice = [].slice;

	  urllite = core;

	  

	  URL = urllite.URL;

	  oldParse = URL.parse;

	  copyProps = function() {
	    var prop, props, source, target, _i, _len;
	    target = arguments[0], source = arguments[1], props = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
	    for (_i = 0, _len = props.length; _i < _len; _i++) {
	      prop = props[_i];
	      target[prop] = source[prop];
	    }
	    return target;
	  };

	  URL.parse = function(raw, opts) {
	    var base, url;
	    if (base = opts != null ? opts.base : void 0) {
	      delete opts.base;
	    }
	    url = oldParse(raw, opts);
	    if (base) {
	      return url.resolve(base);
	    } else {
	      return url;
	    }
	  };

	  URL.prototype.resolve = function(base) {
	    var p, prefix;
	    if (this.isAbsolute) {
	      return new urllite.URL(this);
	    }
	    if (typeof base === 'string') {
	      base = urllite(base);
	    }
	    p = {};
	    if (this.isSchemeRelative) {
	      copyProps(p, this, 'username', 'password', 'host', 'hostname', 'port', 'pathname', 'search', 'hash');
	      p.isSchemeRelative = !(p.protocol = base.protocol);
	    } else if (this.isAbsolutePathRelative || this.isPathRelative) {
	      copyProps(p, this, 'search', 'hash');
	      copyProps(p, base, 'protocol', 'username', 'password', 'host', 'hostname', 'port');
	      p.pathname = this.isPathRelative ? base.pathname.slice(0, -1) === '/' ? "" + base.pathname + "/" + this.pathname : (prefix = base.pathname.split('/').slice(0, -1).join('/'), prefix ? "" + prefix + "/" + this.pathname : this.pathname) : this.pathname;
	    }
	    return new urllite.URL(p).normalize();
	  };

	}).call(commonjsGlobal);

	(function() {
	  var URL, urllite;

	  urllite = core;

	  

	  URL = urllite.URL;

	  URL.prototype.relativize = function(other) {
	    var c, i, newSegments, otherSegments, url, urlSegments, _i, _len, _ref;
	    if (this.isPathRelative) {
	      return new urllite.URL(this);
	    }
	    if (typeof other === 'string') {
	      other = urllite(other);
	    }
	    url = this.resolve(other);
	    if (url.origin && url.origin !== other.origin) {
	      throw new Error("Origins don't match (" + url.origin + " and " + other.origin + ")");
	    } else if (!other.isAbsolute && !other.isAbsolutePathRelative) {
	      throw new Error("Other URL (<" + other + ">) is neither absolute nor absolute path relative.");
	    }
	    otherSegments = other.pathname.split('/').slice(1);
	    urlSegments = url.pathname.split('/').slice(1);
	    for (i = _i = 0, _len = urlSegments.length; _i < _len; i = ++_i) {
	      c = urlSegments[i];
	      if (!(c === otherSegments[i] && (urlSegments.length > (_ref = i + 1) && _ref < otherSegments.length))) {
	        break;
	      }
	    }
	    newSegments = urlSegments.slice(i);
	    while (i < otherSegments.length - 1) {
	      if (otherSegments[i]) {
	        newSegments.unshift('..');
	      }
	      i++;
	    }
	    if (newSegments.length === 1) {
	      newSegments = newSegments[0] === otherSegments[i] ? [''] : newSegments[0] === '' ? ['.'] : newSegments;
	    }
	    return new urllite.URL({
	      pathname: newSegments.join('/'),
	      search: url.search,
	      hash: url.hash
	    });
	  };

	}).call(commonjsGlobal);

	(function() {
	  var URL, urllite;

	  urllite = core;

	  URL = urllite.URL;

	  URL.prototype.toString = function() {
	    var authority, prefix, userinfo;
	    prefix = this.isSchemeRelative ? '//' : this.protocol === 'file:' ? "" + this.protocol + "///" : this.protocol ? "" + this.protocol + "//" : '';
	    userinfo = this.password ? "" + this.username + ":" + this.password : this.username ? "" + this.username : '';
	    authority = userinfo ? "" + userinfo + "@" + this.host : this.host ? "" + this.host : '';
	    return "" + prefix + authority + this.pathname + this.search + this.hash;
	  };

	}).call(commonjsGlobal);

	var complete = createCommonjsModule(function (module) {
	(function() {
	  var urllite;

	  urllite = core;

	  

	  

	  

	  

	  module.exports = urllite;

	}).call(commonjsGlobal);
	});

	/*! *****************************************************************************
	Copyright (c) Microsoft Corporation. All rights reserved.
	Licensed under the Apache License, Version 2.0 (the "License"); you may not use
	this file except in compliance with the License. You may obtain a copy of the
	License at http://www.apache.org/licenses/LICENSE-2.0

	THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
	KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
	WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
	MERCHANTABLITY OR NON-INFRINGEMENT.

	See the Apache Version 2.0 License for specific language governing permissions
	and limitations under the License.
	***************************************************************************** */
	/* global Reflect, Promise */

	var extendStatics = function(d, b) {
	    extendStatics = Object.setPrototypeOf ||
	        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
	        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
	    return extendStatics(d, b);
	};

	function __extends(d, b) {
	    extendStatics(d, b);
	    function __() { this.constructor = d; }
	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	}

	var hasOwn = Object.prototype.hasOwnProperty;
	var toStr = Object.prototype.toString;
	var defineProperty = Object.defineProperty;
	var gOPD = Object.getOwnPropertyDescriptor;

	var isArray = function isArray(arr) {
		if (typeof Array.isArray === 'function') {
			return Array.isArray(arr);
		}

		return toStr.call(arr) === '[object Array]';
	};

	var isPlainObject = function isPlainObject(obj) {
		if (!obj || toStr.call(obj) !== '[object Object]') {
			return false;
		}

		var hasOwnConstructor = hasOwn.call(obj, 'constructor');
		var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
		// Not own constructor property must be Object
		if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
			return false;
		}

		// Own properties are enumerated firstly, so to speed up,
		// if last one is own, then all properties are own.
		var key;
		for (key in obj) { /**/ }

		return typeof key === 'undefined' || hasOwn.call(obj, key);
	};

	// If name is '__proto__', and Object.defineProperty is available, define __proto__ as an own property on target
	var setProperty = function setProperty(target, options) {
		if (defineProperty && options.name === '__proto__') {
			defineProperty(target, options.name, {
				enumerable: true,
				configurable: true,
				value: options.newValue,
				writable: true
			});
		} else {
			target[options.name] = options.newValue;
		}
	};

	// Return undefined instead of __proto__ if '__proto__' is not an own property
	var getProperty = function getProperty(obj, name) {
		if (name === '__proto__') {
			if (!hasOwn.call(obj, name)) {
				return void 0;
			} else if (gOPD) {
				// In early versions of node, obj['__proto__'] is buggy when obj has
				// __proto__ as an own property. Object.getOwnPropertyDescriptor() works.
				return gOPD(obj, name).value;
			}
		}

		return obj[name];
	};

	var extend$1 = function extend() {
		var options, name, src, copy, copyIsArray, clone;
		var target = arguments[0];
		var i = 1;
		var length = arguments.length;
		var deep = false;

		// Handle a deep copy situation
		if (typeof target === 'boolean') {
			deep = target;
			target = arguments[1] || {};
			// skip the boolean and the target
			i = 2;
		}
		if (target == null || (typeof target !== 'object' && typeof target !== 'function')) {
			target = {};
		}

		for (; i < length; ++i) {
			options = arguments[i];
			// Only deal with non-null/undefined values
			if (options != null) {
				// Extend the base object
				for (name in options) {
					src = getProperty(target, name);
					copy = getProperty(options, name);

					// Prevent never-ending loop
					if (target !== copy) {
						// Recurse if we're merging plain objects or arrays
						if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
							if (copyIsArray) {
								copyIsArray = false;
								clone = src && isArray(src) ? src : [];
							} else {
								clone = src && isPlainObject(src) ? src : {};
							}

							// Never move original objects, clone them
							setProperty(target, { name: name, newValue: extend(deep, clone, copy) });

						// Don't bring in undefined values
						} else if (typeof copy !== 'undefined') {
							setProperty(target, { name: name, newValue: copy });
						}
					}
				}
			}
		}

		// Return the modified object
		return target;
	};

	/**
	 * Expose `pathToRegexp`.
	 */
	var pathToRegexp_1 = pathToRegexp;
	var parse_1$1 = parse$1;
	var compile_1 = compile;
	var tokensToFunction_1 = tokensToFunction;
	var tokensToRegExp_1 = tokensToRegExp;

	/**
	 * Default configs.
	 */
	var DEFAULT_DELIMITER = '/';
	var DEFAULT_DELIMITERS = './';

	/**
	 * The main path matching regexp utility.
	 *
	 * @type {RegExp}
	 */
	var PATH_REGEXP = new RegExp([
	  // Match escaped characters that would otherwise appear in future matches.
	  // This allows the user to escape special characters that won't transform.
	  '(\\\\.)',
	  // Match Express-style parameters and un-named parameters with a prefix
	  // and optional suffixes. Matches appear as:
	  //
	  // ":test(\\d+)?" => ["test", "\d+", undefined, "?"]
	  // "(\\d+)"  => [undefined, undefined, "\d+", undefined]
	  '(?:\\:(\\w+)(?:\\(((?:\\\\.|[^\\\\()])+)\\))?|\\(((?:\\\\.|[^\\\\()])+)\\))([+*?])?'
	].join('|'), 'g');

	/**
	 * Parse a string for the raw tokens.
	 *
	 * @param  {string}  str
	 * @param  {Object=} options
	 * @return {!Array}
	 */
	function parse$1 (str, options) {
	  var tokens = [];
	  var key = 0;
	  var index = 0;
	  var path = '';
	  var defaultDelimiter = (options && options.delimiter) || DEFAULT_DELIMITER;
	  var delimiters = (options && options.delimiters) || DEFAULT_DELIMITERS;
	  var pathEscaped = false;
	  var res;

	  while ((res = PATH_REGEXP.exec(str)) !== null) {
	    var m = res[0];
	    var escaped = res[1];
	    var offset = res.index;
	    path += str.slice(index, offset);
	    index = offset + m.length;

	    // Ignore already escaped sequences.
	    if (escaped) {
	      path += escaped[1];
	      pathEscaped = true;
	      continue
	    }

	    var prev = '';
	    var next = str[index];
	    var name = res[2];
	    var capture = res[3];
	    var group = res[4];
	    var modifier = res[5];

	    if (!pathEscaped && path.length) {
	      var k = path.length - 1;

	      if (delimiters.indexOf(path[k]) > -1) {
	        prev = path[k];
	        path = path.slice(0, k);
	      }
	    }

	    // Push the current path onto the tokens.
	    if (path) {
	      tokens.push(path);
	      path = '';
	      pathEscaped = false;
	    }

	    var partial = prev !== '' && next !== undefined && next !== prev;
	    var repeat = modifier === '+' || modifier === '*';
	    var optional = modifier === '?' || modifier === '*';
	    var delimiter = prev || defaultDelimiter;
	    var pattern = capture || group;

	    tokens.push({
	      name: name || key++,
	      prefix: prev,
	      delimiter: delimiter,
	      optional: optional,
	      repeat: repeat,
	      partial: partial,
	      pattern: pattern ? escapeGroup(pattern) : '[^' + escapeString(delimiter) + ']+?'
	    });
	  }

	  // Push any remaining characters.
	  if (path || index < str.length) {
	    tokens.push(path + str.substr(index));
	  }

	  return tokens
	}

	/**
	 * Compile a string to a template function for the path.
	 *
	 * @param  {string}             str
	 * @param  {Object=}            options
	 * @return {!function(Object=, Object=)}
	 */
	function compile (str, options) {
	  return tokensToFunction(parse$1(str, options))
	}

	/**
	 * Expose a method for transforming tokens into the path function.
	 */
	function tokensToFunction (tokens) {
	  // Compile all the tokens into regexps.
	  var matches = new Array(tokens.length);

	  // Compile all the patterns before compilation.
	  for (var i = 0; i < tokens.length; i++) {
	    if (typeof tokens[i] === 'object') {
	      matches[i] = new RegExp('^(?:' + tokens[i].pattern + ')$');
	    }
	  }

	  return function (data, options) {
	    var path = '';
	    var encode = (options && options.encode) || encodeURIComponent;

	    for (var i = 0; i < tokens.length; i++) {
	      var token = tokens[i];

	      if (typeof token === 'string') {
	        path += token;
	        continue
	      }

	      var value = data ? data[token.name] : undefined;
	      var segment;

	      if (Array.isArray(value)) {
	        if (!token.repeat) {
	          throw new TypeError('Expected "' + token.name + '" to not repeat, but got array')
	        }

	        if (value.length === 0) {
	          if (token.optional) continue

	          throw new TypeError('Expected "' + token.name + '" to not be empty')
	        }

	        for (var j = 0; j < value.length; j++) {
	          segment = encode(value[j], token);

	          if (!matches[i].test(segment)) {
	            throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '"')
	          }

	          path += (j === 0 ? token.prefix : token.delimiter) + segment;
	        }

	        continue
	      }

	      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
	        segment = encode(String(value), token);

	        if (!matches[i].test(segment)) {
	          throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but got "' + segment + '"')
	        }

	        path += token.prefix + segment;
	        continue
	      }

	      if (token.optional) {
	        // Prepend partial segment prefixes.
	        if (token.partial) path += token.prefix;

	        continue
	      }

	      throw new TypeError('Expected "' + token.name + '" to be ' + (token.repeat ? 'an array' : 'a string'))
	    }

	    return path
	  }
	}

	/**
	 * Escape a regular expression string.
	 *
	 * @param  {string} str
	 * @return {string}
	 */
	function escapeString (str) {
	  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, '\\$1')
	}

	/**
	 * Escape the capturing group by escaping special characters and meaning.
	 *
	 * @param  {string} group
	 * @return {string}
	 */
	function escapeGroup (group) {
	  return group.replace(/([=!:$/()])/g, '\\$1')
	}

	/**
	 * Get the flags for a regexp from the options.
	 *
	 * @param  {Object} options
	 * @return {string}
	 */
	function flags (options) {
	  return options && options.sensitive ? '' : 'i'
	}

	/**
	 * Pull out keys from a regexp.
	 *
	 * @param  {!RegExp} path
	 * @param  {Array=}  keys
	 * @return {!RegExp}
	 */
	function regexpToRegexp (path, keys) {
	  if (!keys) return path

	  // Use a negative lookahead to match only capturing groups.
	  var groups = path.source.match(/\((?!\?)/g);

	  if (groups) {
	    for (var i = 0; i < groups.length; i++) {
	      keys.push({
	        name: i,
	        prefix: null,
	        delimiter: null,
	        optional: false,
	        repeat: false,
	        partial: false,
	        pattern: null
	      });
	    }
	  }

	  return path
	}

	/**
	 * Transform an array into a regexp.
	 *
	 * @param  {!Array}  path
	 * @param  {Array=}  keys
	 * @param  {Object=} options
	 * @return {!RegExp}
	 */
	function arrayToRegexp (path, keys, options) {
	  var parts = [];

	  for (var i = 0; i < path.length; i++) {
	    parts.push(pathToRegexp(path[i], keys, options).source);
	  }

	  return new RegExp('(?:' + parts.join('|') + ')', flags(options))
	}

	/**
	 * Create a path regexp from string input.
	 *
	 * @param  {string}  path
	 * @param  {Array=}  keys
	 * @param  {Object=} options
	 * @return {!RegExp}
	 */
	function stringToRegexp (path, keys, options) {
	  return tokensToRegExp(parse$1(path, options), keys, options)
	}

	/**
	 * Expose a function for taking tokens and returning a RegExp.
	 *
	 * @param  {!Array}  tokens
	 * @param  {Array=}  keys
	 * @param  {Object=} options
	 * @return {!RegExp}
	 */
	function tokensToRegExp (tokens, keys, options) {
	  options = options || {};

	  var strict = options.strict;
	  var start = options.start !== false;
	  var end = options.end !== false;
	  var delimiter = escapeString(options.delimiter || DEFAULT_DELIMITER);
	  var delimiters = options.delimiters || DEFAULT_DELIMITERS;
	  var endsWith = [].concat(options.endsWith || []).map(escapeString).concat('$').join('|');
	  var route = start ? '^' : '';
	  var isEndDelimited = tokens.length === 0;

	  // Iterate over the tokens and create our regexp string.
	  for (var i = 0; i < tokens.length; i++) {
	    var token = tokens[i];

	    if (typeof token === 'string') {
	      route += escapeString(token);
	      isEndDelimited = i === tokens.length - 1 && delimiters.indexOf(token[token.length - 1]) > -1;
	    } else {
	      var capture = token.repeat
	        ? '(?:' + token.pattern + ')(?:' + escapeString(token.delimiter) + '(?:' + token.pattern + '))*'
	        : token.pattern;

	      if (keys) keys.push(token);

	      if (token.optional) {
	        if (token.partial) {
	          route += escapeString(token.prefix) + '(' + capture + ')?';
	        } else {
	          route += '(?:' + escapeString(token.prefix) + '(' + capture + '))?';
	        }
	      } else {
	        route += escapeString(token.prefix) + '(' + capture + ')';
	      }
	    }
	  }

	  if (end) {
	    if (!strict) route += '(?:' + delimiter + ')?';

	    route += endsWith === '$' ? '$' : '(?=' + endsWith + ')';
	  } else {
	    if (!strict) route += '(?:' + delimiter + '(?=' + endsWith + '))?';
	    if (!isEndDelimited) route += '(?=' + delimiter + '|' + endsWith + ')';
	  }

	  return new RegExp(route, flags(options))
	}

	/**
	 * Normalize the given path string, returning a regular expression.
	 *
	 * An empty array can be passed in for the keys, which will hold the
	 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
	 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
	 *
	 * @param  {(string|RegExp|Array)} path
	 * @param  {Array=}                keys
	 * @param  {Object=}               options
	 * @return {!RegExp}
	 */
	function pathToRegexp (path, keys, options) {
	  if (path instanceof RegExp) {
	    return regexpToRegexp(path, keys)
	  }

	  if (Array.isArray(path)) {
	    return arrayToRegexp(/** @type {!Array} */ (path), keys, options)
	  }

	  return stringToRegexp(/** @type {string} */ (path), keys, options)
	}
	pathToRegexp_1.parse = parse_1$1;
	pathToRegexp_1.compile = compile_1;
	pathToRegexp_1.tokensToFunction = tokensToFunction_1;
	pathToRegexp_1.tokensToRegExp = tokensToRegExp_1;

	var RouterException = (function (_super) {
	    __extends(RouterException, _super);
	    function RouterException(message) {
	        return _super.call(this, message) || this;
	    }
	    return RouterException;
	}(Error));

	var RouterNotFoundException = (function (_super) {
	    __extends(RouterNotFoundException, _super);
	    function RouterNotFoundException(message, matched) {
	        var _this = _super.call(this, message) || this;
	        _this.matched = matched;
	        return _this;
	    }
	    return RouterNotFoundException;
	}(RouterException));

	var RouterConfigBaseManager = (function () {
	    function RouterConfigBaseManager() {
	        this.root = {
	            unrouted: true,
	            configs: {}
	        };
	    }
	    RouterConfigBaseManager.prototype.internalAddConfig = function (configPathParts, config) {
	        var parentConfig = this.root;
	        for (var n = 0; n < configPathParts.length; n++) {
	            var configPathPart = configPathParts[n];
	            var configs = parentConfig.configs || {};
	            var currentConfig = configs[configPathPart];
	            if (!currentConfig) {
	                currentConfig = {
	                    configs: {}
	                };
	                configs[configPathPart] = currentConfig;
	            }
	            if (n === configPathParts.length - 1) {
	                configs[configPathPart] = extend$1(true, currentConfig, config);
	                break;
	            }
	            parentConfig = currentConfig;
	        }
	    };
	    return RouterConfigBaseManager;
	}());

	var RouterConfigManager = (function (_super) {
	    __extends(RouterConfigManager, _super);
	    function RouterConfigManager() {
	        var _this = _super.call(this) || this;
	        _this.buildRouterConfigUrlPrefix(_this.root, '', true, false);
	        return _this;
	    }
	    RouterConfigManager.prototype.addConfig = function (configPath, config, running) {
	        var configPathParts = configPath.split('.');
	        this.internalAddConfig(configPathParts, config);
	        if (running) {
	            this.buildRouterConfigs();
	        }
	    };
	    RouterConfigManager.prototype.getConfigUrl = function (configPath, urlParams, queryParams) {
	        var configPathParts = configPath.split('.');
	        var configs = [];
	        var currentConfig;
	        var parentConfig = this.root;
	        for (var _i = 0, configPathParts_1 = configPathParts; _i < configPathParts_1.length; _i++) {
	            var configPathPart = configPathParts_1[_i];
	            var parentConfigs = parentConfig.configs || {};
	            currentConfig = parentConfigs[configPathPart];
	            if (currentConfig) {
	                configs = configs.concat([currentConfig]);
	                parentConfig = currentConfig;
	            }
	            else {
	                return undefined;
	            }
	        }
	        return this.buildConfigStateUrl(configs, urlParams || {}, queryParams || {});
	    };
	    RouterConfigManager.prototype.findRouterConfigByName = function (configPathParts, context) {
	        return this.internalFindRouterConfigByName(configPathParts, 0, this.root, [], context);
	    };
	    RouterConfigManager.prototype.internalFindRouterConfigByName = function (configPathParts, startRouteNameIndex, parentConfig, configs, context) {
	        var _this = this;
	        return new Promise(function (resolve, reject) {
	            var currentConfig;
	            var _loop_1 = function (n) {
	                var configPathPart = configPathParts[n];
	                var parentConfigs = parentConfig.configs || {};
	                currentConfig = parentConfigs[configPathPart];
	                if (currentConfig) {
	                    configs = configs.concat([currentConfig]);
	                    parentConfig = currentConfig;
	                }
	                else {
	                    if (parentConfig.routeExtensionCallback && !parentConfig.routeExtended) {
	                        _this.extendRouterConfig(configPathParts, parentConfig, context).then(function (config) {
	                            resolve(_this.internalFindRouterConfigByName(configPathParts, n, config, configs, context));
	                        }).catch(function (error) {
	                            reject(error);
	                        });
	                    }
	                    else {
	                        reject(new RouterNotFoundException('Unable to find router config for path: ' + configPathParts.join('.'), configs));
	                    }
	                    return { value: void 0 };
	                }
	            };
	            for (var n = startRouteNameIndex; n < configPathParts.length; n++) {
	                var state_1 = _loop_1(n);
	                if (typeof state_1 === "object")
	                    return state_1.value;
	            }
	            resolve(configs);
	        });
	    };
	    RouterConfigManager.prototype.findRoutedConfigByUrl = function (url, context) {
	        return this.internalFindRoutedConfigByUrl(this.root, [], url, [], context);
	    };
	    RouterConfigManager.prototype.internalFindRoutedConfigByUrl = function (config, configPath, url, configs, context) {
	        var _this = this;
	        return new Promise(function (resolve, reject) {
	            var pathPrefixRegExp = config.pathPrefixRegExp;
	            var subConfigs;
	            if (pathPrefixRegExp || config.rootSubUrl) {
	                var pathPrefixParams_1 = null;
	                if (pathPrefixRegExp) {
	                    pathPrefixParams_1 = pathPrefixRegExp.exec(url);
	                }
	                if (pathPrefixParams_1 || config.rootSubUrl) {
	                    if (config.routeExtensionCallback && !config.routeExtended) {
	                        _this.extendRouterConfig(configPath, config, context).then(function (extConfig) {
	                            resolve(_this.internalFindRoutedConfigByUrl(extConfig, configPath, url, configs, context));
	                        }).catch(function (error) {
	                            reject(error);
	                        });
	                        return;
	                    }
	                    subConfigs = configs.concat([config]);
	                    var subCalls = [];
	                    var configConfigs = config.configs || {};
	                    for (var key in configConfigs) {
	                        if (!configConfigs.hasOwnProperty(key)) {
	                            continue;
	                        }
	                        var subConfig = configConfigs[key];
	                        subCalls.push(_this.internalFindRoutedConfigByUrl(subConfig, configPath.concat([key]), url, subConfigs, context));
	                    }
	                    if (subCalls.length > 0) {
	                        Promise.all(subCalls).then(function (subMatches) {
	                            var bestMatch;
	                            for (var _i = 0, subMatches_1 = subMatches; _i < subMatches_1.length; _i++) {
	                                var subMatch = subMatches_1[_i];
	                                if (subMatch) {
	                                    if (!bestMatch
	                                        || (!subMatch.prefixMatch
	                                            && bestMatch.prefixMatch)
	                                        || (subMatch.configMatches
	                                            && (!bestMatch.configMatches
	                                                || ((subMatch.prefixMatch === bestMatch.prefixMatch)
	                                                    && (subMatch.configMatches.length > bestMatch.configMatches.length))))) {
	                                        bestMatch = subMatch;
	                                    }
	                                }
	                            }
	                            if (bestMatch && bestMatch.prefixMatch) {
	                                var match = _this.matchRoutedConfigToUrl(config, configPath, url, configs, pathPrefixParams_1);
	                                if (match && !match.prefixMatch) {
	                                    bestMatch = match;
	                                }
	                            }
	                            if (bestMatch) {
	                                resolve(bestMatch);
	                            }
	                            else {
	                                resolve(_this.matchRoutedConfigToUrl(config, configPath, url, configs, pathPrefixParams_1));
	                            }
	                        }).catch(function (reason) {
	                            reject(reason);
	                        });
	                        return;
	                    }
	                    resolve(_this.matchRoutedConfigToUrl(config, configPath, url, configs, pathPrefixParams_1));
	                    return;
	                }
	            }
	            resolve(_this.matchRoutedConfigToUrl(config, configPath, url, configs, null));
	        });
	    };
	    RouterConfigManager.prototype.matchRoutedConfigToUrl = function (config, configPath, url, configs, pathPrefixParams) {
	        if (config.pathRegExp) {
	            var pathMatches = config.pathRegExp.exec(url);
	            if (pathMatches) {
	                configs = configs.slice(1);
	                configs.push(config);
	                return {
	                    configPath: configPath.join('.'),
	                    pathMatches: pathMatches,
	                    configMatches: configs,
	                    prefixMatch: false
	                };
	            }
	        }
	        if (pathPrefixParams) {
	            configs = configs.slice(1);
	            configs.push(config);
	            return {
	                configPath: configPath.join('.'),
	                pathMatches: pathPrefixParams,
	                configMatches: configs,
	                prefixMatch: true
	            };
	        }
	        return undefined;
	    };
	    RouterConfigManager.prototype.extendRouterConfig = function (configPath, config, context) {
	        var _this = this;
	        if (!config.routeExtensionPromise) {
	            config.routeExtensionPromise = new Promise(function (resolve, reject) {
	                if (!config.routeExtensionCallback) {
	                    reject(new Error(''));
	                }
	                else {
	                    var routeExtension = config.routeExtensionCallback(configPath.join('.'), config, context);
	                    routeExtension.then(function (configMap) {
	                        config.routeExtended = true;
	                        config.routeExtensionPromise = undefined;
	                        if (configMap) {
	                            config.configs = extend$1(true, config.configs || {}, configMap);
	                            _this.buildRouterConfigs();
	                            resolve(config);
	                        }
	                        else {
	                            reject(new RouterException('Router extension in "' + configPath.join('.') + '" did not return a config map'));
	                        }
	                    }).catch(function (error) {
	                        config.routeExtensionPromise = undefined;
	                        reject(error);
	                    });
	                }
	            });
	        }
	        return config.routeExtensionPromise;
	    };
	    RouterConfigManager.prototype.buildRouterConfigs = function () {
	        this.buildRouterMappingForConfig(this.root, '');
	    };
	    RouterConfigManager.prototype.buildRouterMappingForConfig = function (config, urlPrefix) {
	        var url = this.buildConfigUrl(urlPrefix, config.url);
	        config.configs = config.configs || {};
	        var hasRootConfigUrl = false;
	        var hasRoutedSubConfig = !!config.routeExtensionCallback && !config.routeExtended;
	        for (var key in config.configs) {
	            if (!config.configs.hasOwnProperty(key)) {
	                continue;
	            }
	            var subConfig = config.configs[key];
	            var subFlags = this.buildRouterMappingForConfig(subConfig, url);
	            if (subFlags[0]) {
	                hasRoutedSubConfig = true;
	            }
	            if (subFlags[1]) {
	                hasRootConfigUrl = true;
	            }
	        }
	        var isRoutedConfig = this.buildRoutedConfigUrlMapping(config, url);
	        this.buildRouterConfigUrlPrefix(config, url, hasRoutedSubConfig, hasRootConfigUrl);
	        return [isRoutedConfig || hasRoutedSubConfig, hasRootConfigUrl || this.hasRootConfigUrl(config.url)];
	    };
	    RouterConfigManager.prototype.buildConfigUrl = function (urlPrefix, configUrl) {
	        if (!configUrl) {
	            return urlPrefix;
	        }
	        if (this.hasRootConfigUrl(configUrl)) {
	            if ((configUrl.length < 2) || (configUrl.charAt(1) !== '/')) {
	                return '/' + configUrl.substring(1);
	            }
	            else {
	                return configUrl.substring(1);
	            }
	        }
	        else if (urlPrefix === '/') {
	            if (configUrl.charAt(0) !== '/') {
	                return '/' + configUrl;
	            }
	            else {
	                return configUrl;
	            }
	        }
	        else {
	            if (configUrl.charAt(0) !== '/') {
	                return urlPrefix + '/' + configUrl;
	            }
	            else {
	                return urlPrefix + configUrl;
	            }
	        }
	    };
	    RouterConfigManager.prototype.hasRootConfigUrl = function (configUrl) {
	        return !!configUrl && (configUrl.charAt(0) === '^');
	    };
	    RouterConfigManager.prototype.buildRoutedConfigUrlMapping = function (config, url) {
	        if (config.url && !config.unrouted) {
	            var pathTokens = pathToRegexp_1.parse(url);
	            config.pathRegExp = pathToRegexp_1.tokensToRegExp(pathTokens, undefined, {});
	            config.pathBuildFunc = pathToRegexp_1.tokensToFunction(pathTokens);
	            config.pathParams = [];
	            for (var _i = 0, pathTokens_1 = pathTokens; _i < pathTokens_1.length; _i++) {
	                var pathToken = pathTokens_1[_i];
	                if (typeof pathToken !== 'string') {
	                    config.pathParams.push(pathToken);
	                }
	            }
	            return true;
	        }
	        else {
	            delete config.pathParams;
	            delete config.pathRegExp;
	            delete config.pathBuildFunc;
	            return false;
	        }
	    };
	    RouterConfigManager.prototype.buildRouterConfigUrlPrefix = function (config, url, hasRoutedSubConfig, hasRootConfigUrl) {
	        if (hasRoutedSubConfig) {
	            var pathParams = [];
	            if (url === '/') {
	                url = url + '(.*)';
	            }
	            else {
	                url = url + '/(.*)';
	            }
	            config.pathPrefixRegExp = pathToRegexp_1(url, pathParams);
	            config.pathPrefixParams = pathParams;
	        }
	        else {
	            delete config.pathPrefixRegExp;
	            delete config.pathPrefixParams;
	        }
	        config.rootSubUrl = hasRootConfigUrl;
	    };
	    RouterConfigManager.prototype.buildConfigStateUrl = function (configs, urlParams, queryParams) {
	        for (var n = configs.length - 1; n >= 0; n--) {
	            var config = configs[n];
	            if (config.pathBuildFunc) {
	                var url = config.pathBuildFunc(urlParams);
	                var params = {};
	                for (var key in queryParams) {
	                    if (!queryParams.hasOwnProperty(key)) {
	                        continue;
	                    }
	                    var value = queryParams[key];
	                    if (value) {
	                        params[key] = value;
	                    }
	                }
	                var queryStr = stringify(params);
	                if (queryStr) {
	                    url = url + '?' + queryStr;
	                }
	                return url;
	            }
	        }
	        return '/';
	    };
	    RouterConfigManager.prototype.findAndBuildUrlParams = function (url, configs) {
	        if (!url || !configs) {
	            return {};
	        }
	        for (var n = configs.length - 1; n >= 0; n--) {
	            var config = configs[n];
	            if (config.pathRegExp) {
	                var pathMatches = config.pathRegExp.exec(url);
	                if (pathMatches) {
	                    return this.internalBuildUrlParams(config.pathParams, pathMatches);
	                }
	            }
	            if (config.pathPrefixRegExp) {
	                var pathMatches = config.pathPrefixRegExp.exec(url);
	                if (pathMatches) {
	                    return this.internalBuildUrlParams(config.pathPrefixParams, pathMatches);
	                }
	            }
	        }
	        return {};
	    };
	    RouterConfigManager.prototype.buildUrlParams = function (config, pathMatches) {
	        return this.internalBuildUrlParams(config.pathParams, pathMatches);
	    };
	    RouterConfigManager.prototype.internalBuildUrlParams = function (pathParams, pathMatches) {
	        var urlParams = {};
	        if (pathParams) {
	            for (var n = 0; (n < pathParams.length) && (n + 1 < pathMatches.length); n++) {
	                urlParams[pathParams[n].name] = pathMatches[n + 1];
	            }
	        }
	        return urlParams;
	    };
	    RouterConfigManager.prototype.findErrorPathInMatch = function (configMatch) {
	        if (!configMatch || !configMatch.configMatches) {
	            return undefined;
	        }
	        for (var n = configMatch.configMatches.length - 1; n >= 0; n--) {
	            var config = configMatch.configMatches[n];
	            if (config.errorPath) {
	                return config.errorPath;
	            }
	        }
	        return undefined;
	    };
	    return RouterConfigManager;
	}(RouterConfigBaseManager));

	var RouterStateManager = (function () {
	    function RouterStateManager() {
	        this.accumulatedPropNames = [];
	        this.nonInheritedPropNames = [];
	        this.currentState = {
	            configPath: '',
	            url: '',
	            urlParams: {},
	            queryParams: {},
	            historyTrackId: undefined,
	            transitionId: 0,
	            data: {}
	        };
	        this.currentStateDatas = [];
	        this.currentConfigs = [];
	    }
	    RouterStateManager.prototype.getCurrentState = function () {
	        return this.currentState;
	    };
	    RouterStateManager.prototype.setAccumulatedStateDataPropNames = function (propNames) {
	        this.accumulatedPropNames = propNames;
	    };
	    RouterStateManager.prototype.setNonInheritedStateDataPropNames = function (propNames) {
	        this.nonInheritedPropNames = propNames;
	    };
	    RouterStateManager.prototype.updateState = function (configPath, url, urlParams, queryParams, historyTrackId, transitionId, newConfigs, extraStateData, context) {
	        var state = {
	            configPath: configPath,
	            url: url,
	            urlParams: urlParams,
	            queryParams: queryParams,
	            historyTrackId: historyTrackId,
	            transitionId: transitionId,
	            data: {}
	        };
	        var newStateDatas = [];
	        var accumulatedDataProps = this.prepareAccumulatedPropNames();
	        var prefixLength = this.findCommonStatePrefix(newConfigs);
	        var lastStateData;
	        for (var n = 0; n < prefixLength; n++) {
	            var newConfig = newConfigs[n];
	            if (newConfig.refreshCallback) {
	                lastStateData = newConfig.refreshCallback(state, state.data, this.currentStateDatas[n], context);
	            }
	            else {
	                lastStateData = this.currentStateDatas[n];
	            }
	            newStateDatas.push(lastStateData);
	            this.accumulateStateDataProps(accumulatedDataProps, newStateDatas[n]);
	            state.data = extend$1(true, state.data, newStateDatas[n]);
	        }
	        for (var n = prefixLength; n < newConfigs.length; n++) {
	            var newConfig = newConfigs[n];
	            if (newConfig.setupCallback) {
	                lastStateData = newConfig.setupCallback(state, state.data, extend$1({}, newConfig.data || {}), context);
	            }
	            else {
	                lastStateData = newConfig.data || {};
	            }
	            newStateDatas.push(lastStateData);
	            this.accumulateStateDataProps(accumulatedDataProps, newStateDatas[n]);
	            state.data = extend$1(true, state.data, newStateDatas[n]);
	        }
	        this.removeNonInheritedPropNames(state.data, lastStateData);
	        for (var n = this.currentConfigs.length - 1; n >= prefixLength; n--) {
	            var oldConfig = this.currentConfigs[n];
	            if (oldConfig.teardownCallback) {
	                oldConfig.teardownCallback(this.currentStateDatas[n], context);
	            }
	        }
	        this.insertAccumulatedStateDataProps(state.data, accumulatedDataProps);
	        if (extraStateData) {
	            state.data = extend$1(true, state.data, extraStateData);
	        }
	        this.currentState = state;
	        this.currentStateDatas = newStateDatas;
	        this.currentConfigs = newConfigs;
	        return state;
	    };
	    RouterStateManager.prototype.findCommonStatePrefix = function (newConfigs) {
	        var maxLength = Math.max(newConfigs.length, this.currentConfigs.length);
	        var length = 0;
	        while (length < maxLength) {
	            if (newConfigs[length] !== this.currentConfigs[length]) {
	                return length;
	            }
	            length++;
	        }
	        return length;
	    };
	    RouterStateManager.prototype.removeNonInheritedPropNames = function (data, lastData) {
	        if (lastData) {
	            for (var _i = 0, _a = this.nonInheritedPropNames; _i < _a.length; _i++) {
	                var nonInheritedPropName = _a[_i];
	                if (!lastData.hasOwnProperty(nonInheritedPropName)) {
	                    delete data[nonInheritedPropName];
	                }
	            }
	        }
	    };
	    RouterStateManager.prototype.prepareAccumulatedPropNames = function () {
	        var result = {};
	        for (var _i = 0, _a = this.accumulatedPropNames; _i < _a.length; _i++) {
	            var accumulatedPropName = _a[_i];
	            result[accumulatedPropName] = [];
	        }
	        return result;
	    };
	    RouterStateManager.prototype.accumulateStateDataProps = function (accumulatedDataProps, data) {
	        for (var name_1 in data) {
	            if (!data.hasOwnProperty(name_1)) {
	                continue;
	            }
	            var values = accumulatedDataProps[name_1];
	            if ((name_1 && (name_1.charAt(0) === '+')) || (values !== undefined)) {
	                if (!values) {
	                    values = [];
	                }
	                var value = data[name_1];
	                if (Array.isArray(value)) {
	                    values = values.concat(value);
	                }
	                else {
	                    values.push(value);
	                }
	                accumulatedDataProps[name_1] = values;
	            }
	        }
	    };
	    RouterStateManager.prototype.insertAccumulatedStateDataProps = function (data, accumulatedDataProps) {
	        for (var name_2 in accumulatedDataProps) {
	            if (!accumulatedDataProps.hasOwnProperty(name_2)) {
	                continue;
	            }
	            if (name_2.charAt(0) === '+') {
	                data[name_2.substring(1)] = accumulatedDataProps[name_2];
	                delete data[name_2];
	            }
	            else {
	                data[name_2] = accumulatedDataProps[name_2];
	            }
	        }
	    };
	    return RouterStateManager;
	}());

	var RouterCancelledException = (function (_super) {
	    __extends(RouterCancelledException, _super);
	    function RouterCancelledException() {
	        return _super.call(this, 'Cancelled') || this;
	    }
	    return RouterCancelledException;
	}(RouterException));

	var Router = (function () {
	    function Router(historyManager, configManager, stateManager) {
	        var _this = this;
	        this.pendingReload = false;
	        this.running = false;
	        this.updateFromHistory = function () {
	            return new Promise(function (resolve, reject) {
	                if (!_this.isRunning()) {
	                    reject(new RouterException('Router is not running'));
	                    return;
	                }
	                var url = _this.history.getUrl();
	                var configPath = _this.history.getConfigPath();
	                var context = _this.contextFromEventCallback ? _this.contextFromEventCallback() : undefined;
	                var transitionIdSnapshot = _this.beginNewTransition(undefined, undefined, undefined, undefined, context);
	                if (!url) {
	                    if (_this.urlMissingRouteCallback) {
	                        _this.urlMissingRouteCallback(transitionIdSnapshot, context);
	                    }
	                    reject(new RouterException('Router missing URL'));
	                    return;
	                }
	                var urlParts = complete(url);
	                var queryParams = urlParts.search ? parse_1(urlParts.search) : {};
	                var historyTrackId = _this.history.getHistoryTrackId();
	                if (configPath) {
	                    var configPathParts = configPath.split('.');
	                    _this.config.findRouterConfigByName(configPathParts, context).then(function (configs) {
	                        if (_this.isTransitionCancelled(transitionIdSnapshot)) {
	                            reject(new RouterCancelledException());
	                            return;
	                        }
	                        var state = _this.updateStateFromNamedConfig(configPath, url, urlParts.pathname, queryParams, historyTrackId, transitionIdSnapshot, configs, context);
	                        _this.endCurrentTransition(transitionIdSnapshot);
	                        resolve(state);
	                    }).catch(function (error) {
	                        _this.fireRouteNotFoundCallback(error, configPath, url, transitionIdSnapshot, context);
	                        _this.cancelCurrentTransition(transitionIdSnapshot, context);
	                        reject(error);
	                    });
	                }
	                else {
	                    var errorPath_1;
	                    var findPromise = _this.config.findRoutedConfigByUrl(urlParts.pathname, context);
	                    findPromise.then(function (configMatch) {
	                        if (_this.isTransitionCancelled(transitionIdSnapshot)) {
	                            return undefined;
	                        }
	                        if (!configMatch) {
	                            throw new RouterNotFoundException('Unable to find state for URL: ' + url, undefined);
	                        }
	                        else if (configMatch.prefixMatch) {
	                            errorPath_1 = _this.config.findErrorPathInMatch(configMatch);
	                            if (errorPath_1) {
	                                return _this.config.findRouterConfigByName(errorPath_1.split('.'), context);
	                            }
	                            else {
	                                throw new RouterNotFoundException('Unable to find state for URL: ' + url, configMatch.configMatches);
	                            }
	                        }
	                        var newConfig = configMatch.configMatches[configMatch.configMatches.length - 1];
	                        if (_this.pendingReload && newConfig.url && newConfig.reloadable) {
	                            _this.history.reloadAtUrl(url);
	                        }
	                        var urlParams = _this.config.buildUrlParams(newConfig, configMatch.pathMatches);
	                        var currentState = _this.state.updateState(configMatch.configPath, url, urlParams, queryParams, historyTrackId, transitionIdSnapshot, configMatch.configMatches, undefined, context);
	                        if (_this.routeFoundCallback) {
	                            _this.routeFoundCallback(currentState, context);
	                        }
	                        _this.endCurrentTransition(transitionIdSnapshot);
	                        return undefined;
	                    }).then(function (configs) {
	                        if (!configs) {
	                            resolve(_this.state.getCurrentState());
	                            return;
	                        }
	                        if (_this.isTransitionCancelled(transitionIdSnapshot)) {
	                            reject(new RouterCancelledException());
	                            return;
	                        }
	                        var state = _this.updateStateFromNamedConfig(errorPath_1 || '', url, urlParts.pathname, queryParams, historyTrackId, transitionIdSnapshot, configs, context);
	                        _this.endCurrentTransition(transitionIdSnapshot);
	                        resolve(state);
	                    }).catch(function (error) {
	                        _this.fireRouteNotFoundCallback(error, undefined, url, transitionIdSnapshot, context);
	                        _this.cancelCurrentTransition(transitionIdSnapshot, context);
	                        reject(error);
	                    });
	                }
	            });
	        };
	        this.history = historyManager;
	        this.config = configManager || new RouterConfigManager();
	        this.state = stateManager || new RouterStateManager();
	        this.transitionId = 0;
	        this.lastDoneTransitionId = 0;
	    }
	    Router.prototype.getCurrentState = function () {
	        return this.state.getCurrentState();
	    };
	    Router.prototype.setAccumulatedStateDataPropNames = function (propNames) {
	        this.state.setAccumulatedStateDataPropNames(propNames);
	    };
	    Router.prototype.setNonInheritedStateDataPropNames = function (propNames) {
	        this.state.setNonInheritedStateDataPropNames(propNames);
	    };
	    Router.prototype.isRunning = function () {
	        return this.running;
	    };
	    Router.prototype.requestReload = function () {
	        this.pendingReload = true;
	    };
	    Router.prototype.addConfig = function (configPath, config) {
	        this.config.addConfig(configPath, config, this.isRunning());
	    };
	    Router.prototype.getConfigUrl = function (configPath, urlParams, queryParams) {
	        if (!this.isRunning()) {
	            throw new RouterException('Router not running');
	        }
	        var configUrl = this.config.getConfigUrl(configPath, urlParams, queryParams);
	        if (configUrl) {
	            return this.history.getFullUrl(configUrl);
	        }
	        else {
	            return configUrl;
	        }
	    };
	    Router.prototype.start = function (_a) {
	        var routeFoundCallback = _a.routeFoundCallback, routeNotFoundCallback = _a.routeNotFoundCallback, urlMissingRouteCallback = _a.urlMissingRouteCallback, transitionBegin = _a.transitionBegin, transitionCancel = _a.transitionCancel, transitionEnd = _a.transitionEnd, contextFromEventCallback = _a.contextFromEventCallback;
	        if (this.isRunning()) {
	            throw new RouterException('Router already running');
	        }
	        this.routeFoundCallback = routeFoundCallback;
	        this.routeNotFoundCallback = routeNotFoundCallback;
	        this.urlMissingRouteCallback = urlMissingRouteCallback;
	        this.transitionBegin = transitionBegin;
	        this.transitionCancel = transitionCancel;
	        this.transitionEnd = transitionEnd;
	        this.contextFromEventCallback = contextFromEventCallback;
	        this.history.startHistoryUpdates(this.updateFromHistory);
	        this.config.buildRouterConfigs();
	        this.running = true;
	        this.history.init();
	    };
	    Router.prototype.stop = function () {
	        if (this.isRunning()) {
	            this.history.stopHistoryUpdates();
	        }
	        this.running = false;
	    };
	    Router.prototype.navigateTo = function (configPath, urlParams, queryParams, extraStateData, context) {
	        return this.changeState(configPath, urlParams, queryParams, extraStateData, context, false);
	    };
	    Router.prototype.redirectTo = function (configPath, urlParams, queryParams, extraStateData, context) {
	        return this.changeState(configPath, urlParams, queryParams, extraStateData, context, true);
	    };
	    Router.prototype.changeState = function (configPath, urlParams, queryParams, extraStateData, context, replace) {
	        var _this = this;
	        if (!this.isRunning()) {
	            throw new RouterException('Router is not running');
	        }
	        var transitionIdSnapshot = this.beginNewTransition(configPath, urlParams, queryParams, extraStateData);
	        return new Promise(function (resolve, reject) {
	            var configPathParts = configPath.split('.');
	            _this.config.findRouterConfigByName(configPathParts, context).then(function (configs) {
	                if (_this.isTransitionCancelled(transitionIdSnapshot)) {
	                    reject(new RouterCancelledException());
	                    return;
	                }
	                var newConfig = configs[configs.length - 1];
	                if (newConfig.unrouted) {
	                    throw new RouterNotFoundException('Unable to navigate to unrouted path: ' + configPath, configs);
	                }
	                var url = _this.config.buildConfigStateUrl(configs, urlParams || {}, queryParams || {});
	                if (_this.pendingReload && newConfig.url && newConfig.reloadable) {
	                    _this.history.reloadAtUrl(url);
	                }
	                if (replace) {
	                    _this.history.redirectTo(configPath, url);
	                }
	                else {
	                    _this.history.navigateTo(configPath, url);
	                }
	                var historyTrackId = _this.history.getHistoryTrackId();
	                var currentState = _this.state.updateState(configPath, url, urlParams || {}, queryParams || {}, historyTrackId, transitionIdSnapshot, configs, extraStateData, context);
	                if (_this.routeFoundCallback) {
	                    _this.routeFoundCallback(currentState, context);
	                }
	                _this.endCurrentTransition(transitionIdSnapshot, configPath, urlParams, queryParams, extraStateData);
	                resolve(currentState);
	            }).catch(function (error) {
	                _this.fireRouteNotFoundCallback(error, configPath, undefined, transitionIdSnapshot, context);
	                if (_this.transitionCancel) {
	                    _this.transitionCancel(transitionIdSnapshot, configPath, urlParams, queryParams, extraStateData);
	                }
	                reject(error);
	            });
	        });
	    };
	    Router.prototype.beginNewTransition = function (configPath, urlParams, queryParams, extraStateData, context) {
	        if (this.lastDoneTransitionId < this.transitionId) {
	            if (this.transitionCancel) {
	                this.transitionCancel(this.transitionId, configPath, urlParams, queryParams, extraStateData, context);
	            }
	            this.lastDoneTransitionId = this.transitionId;
	        }
	        this.transitionId = this.transitionId + 1;
	        if (this.transitionBegin) {
	            this.transitionBegin(this.transitionId, configPath, urlParams, queryParams, extraStateData, context);
	        }
	        return this.transitionId;
	    };
	    Router.prototype.isTransitionCancelled = function (transitionIdSnapshot) {
	        return transitionIdSnapshot !== this.transitionId;
	    };
	    Router.prototype.endCurrentTransition = function (transitionIdSnapshot, configPath, urlParams, queryParams, extraStateData, context) {
	        if (transitionIdSnapshot === this.transitionId) {
	            if (this.transitionEnd) {
	                this.transitionEnd(this.transitionId, configPath, urlParams, queryParams, extraStateData, context);
	            }
	            this.lastDoneTransitionId = this.transitionId;
	        }
	    };
	    Router.prototype.cancelCurrentTransition = function (transitionIdSnapshot, context) {
	        if (this.lastDoneTransitionId < transitionIdSnapshot) {
	            if (this.transitionCancel) {
	                this.transitionCancel(transitionIdSnapshot, undefined, undefined, undefined, undefined, context);
	            }
	            this.lastDoneTransitionId = transitionIdSnapshot;
	        }
	    };
	    Router.prototype.updateStateFromNamedConfig = function (configPath, url, urlPath, queryParams, historyTrackId, transitionId, configs, context) {
	        var newConfig = configs[configs.length - 1];
	        if (newConfig.unrouted) {
	            throw new RouterNotFoundException('Unable to change to unrouted path: ' + configPath, configs);
	        }
	        if (this.pendingReload && newConfig.url && newConfig.reloadable) {
	            this.history.reloadAtUrl(url);
	        }
	        var urlParams = this.config.findAndBuildUrlParams(urlPath, configs);
	        var currentState = this.state.updateState(configPath, url, urlParams, queryParams, historyTrackId, transitionId, configs, undefined, context);
	        if (this.routeFoundCallback) {
	            this.routeFoundCallback(currentState, context);
	        }
	        return currentState;
	    };
	    Router.prototype.fireRouteNotFoundCallback = function (error, configPath, url, transitionId, context) {
	        if (this.routeNotFoundCallback) {
	            var matchedConfigs = void 0;
	            if (error instanceof RouterNotFoundException) {
	                matchedConfigs = error.matched;
	            }
	            this.routeNotFoundCallback(configPath, url, matchedConfigs, error, transitionId, context);
	        }
	        else {
	            this.logError(error);
	        }
	    };
	    Router.prototype.logError = function (error) {
	        if (console && console.error) {
	            console.error(error);
	        }
	    };
	    return Router;
	}());

	var RouterHistoryManager = (function () {
	    function RouterHistoryManager(urlPathPrefix, useHashMode, browserLocation, browserHistory, browserStorage, maxHistoryEntries, disposeHistoryEntryCallback) {
	        if (browserLocation === void 0) { browserLocation = location; }
	        if (browserHistory === void 0) { browserHistory = history; }
	        if (browserStorage === void 0) { browserStorage = sessionStorage; }
	        if (maxHistoryEntries === void 0) { maxHistoryEntries = 50; }
	        var _this = this;
	        this.updateUrlFromHashChange = function () {
	            _this.updateUrlFromPopState();
	        };
	        this.updateUrlFromPopState = function () {
	            var entry = _this.readPopState();
	            if (!entry) {
	                var url = _this.getUrl();
	                if (!url) {
	                    url = _this.getUrlFromOtherMode();
	                }
	                if (url) {
	                    entry = _this.createHistoryState(undefined, url);
	                    entry = _this.rewritePopState(entry);
	                }
	            }
	            var callUpdate = (_this.currentHistoryEntry !== entry) || ((_this.currentHistoryEntry === null) && (entry === null));
	            if (entry) {
	                _this.updateHistoryEntries(entry);
	            }
	            if (callUpdate && _this.updateUrlCallback) {
	                _this.updateUrlCallback().catch(function () {
	                });
	            }
	        };
	        this.urlPathPrefix = urlPathPrefix || '';
	        this.useHashMode = useHashMode;
	        this.browserLocation = browserLocation;
	        this.browserHistory = browserHistory;
	        this.browserStorage = browserStorage;
	        this.maxHistoryEntries = maxHistoryEntries;
	        this.disposeHistoryEntryCallback = disposeHistoryEntryCallback;
	        this.currentHistoryEntry = undefined;
	        this.historyBackEntries = [];
	        this.historyForwardEntries = [];
	        if (!this.useHashMode && this.urlPathPrefix && (this.urlPathPrefix.charAt(this.urlPathPrefix.length - 1) === '/')) {
	            this.urlPathPrefix = this.urlPathPrefix.substring(0, this.urlPathPrefix.length - 1);
	        }
	    }
	    RouterHistoryManager.prototype.startHistoryUpdates = function (updateUrlCallback, eventTarget) {
	        if (eventTarget === void 0) { eventTarget = window; }
	        this.updateUrlCallback = updateUrlCallback;
	        if (!this.updateUrlCallback) {
	            throw new RouterException('Unable to start history updates with null callback');
	        }
	        this.installEventListener(eventTarget, 'popstate', this.updateUrlFromPopState);
	        this.installEventListener(eventTarget, 'hashchange', this.updateUrlFromHashChange);
	    };
	    RouterHistoryManager.prototype.stopHistoryUpdates = function (eventTarget) {
	        if (eventTarget === void 0) { eventTarget = window; }
	        this.uninstallEventListener(eventTarget, 'hashchange', this.updateUrlFromHashChange);
	        this.uninstallEventListener(eventTarget, 'popstate', this.updateUrlFromPopState);
	        this.updateUrlCallback = undefined;
	    };
	    RouterHistoryManager.prototype.init = function () {
	        this.updateUrlFromPopState();
	    };
	    RouterHistoryManager.prototype.reloadAtUrl = function (url) {
	        if (this.useHashMode) {
	            this.browserLocation.hash = this.buildFullHashUrl(url);
	            this.browserLocation.reload(true);
	        }
	        else {
	            this.browserLocation.href = this.urlPathPrefix + url;
	        }
	    };
	    RouterHistoryManager.prototype.navigateTo = function (configPath, url) {
	        var entry = this.createHistoryState(configPath, url);
	        this.writePopState(entry);
	        this.updateHistoryEntries(entry);
	    };
	    RouterHistoryManager.prototype.redirectTo = function (configPath, url) {
	        var entry = this.createHistoryState(configPath, url);
	        this.rewritePopState(entry);
	        this.updateHistoryEntries(entry);
	    };
	    RouterHistoryManager.prototype.getUrl = function () {
	        if (this.useHashMode) {
	            if ((this.urlPathPrefix && (this.browserLocation.pathname !== this.urlPathPrefix))
	                || !this.browserLocation.hash
	                || (this.browserLocation.hash.length < 2)) {
	                return undefined;
	            }
	            return this.browserLocation.hash.substring(1);
	        }
	        else {
	            if (this.urlPathPrefix && (this.browserLocation.pathname.substring(0, this.urlPathPrefix.length + 1) !== this.urlPathPrefix + '/')) {
	                return undefined;
	            }
	            return this.browserLocation.pathname.substring(this.urlPathPrefix ? this.urlPathPrefix.length : 0) + this.browserLocation.search;
	        }
	    };
	    RouterHistoryManager.prototype.getFullUrl = function (configUrl) {
	        if (this.useHashMode) {
	            return this.buildFullHashUrl(configUrl);
	        }
	        else {
	            return this.urlPathPrefix + configUrl;
	        }
	    };
	    RouterHistoryManager.prototype.getUrlFromOtherMode = function () {
	        if (this.useHashMode) {
	            var prefix = this.urlPathPrefix;
	            if (prefix && (prefix.charAt(prefix.length - 1) === '/')) {
	                prefix = prefix.substring(0, prefix.length - 1);
	            }
	            if (prefix && (this.browserLocation.pathname.substring(0, prefix.length + 1) !== prefix + '/')) {
	                return undefined;
	            }
	            return this.browserLocation.pathname.substring(prefix ? prefix.length : 0);
	        }
	        else {
	            if ((this.urlPathPrefix
	                && (this.browserLocation.pathname !== this.urlPathPrefix)
	                && (this.browserLocation.pathname !== this.urlPathPrefix + '/')) || !this.browserLocation.hash || (this.browserLocation.hash.length < 2)) {
	                return undefined;
	            }
	            return this.browserLocation.hash.substring(1);
	        }
	    };
	    RouterHistoryManager.prototype.getConfigPath = function () {
	        if (this.currentHistoryEntry) {
	            return this.currentHistoryEntry.configPath;
	        }
	        else {
	            return undefined;
	        }
	    };
	    RouterHistoryManager.prototype.getHistoryTrackId = function () {
	        if (this.currentHistoryEntry) {
	            return this.currentHistoryEntry.historyTrackId;
	        }
	        else {
	            return undefined;
	        }
	    };
	    RouterHistoryManager.prototype.updateHistoryEntries = function (newEntry) {
	        this.currentHistoryEntry = newEntry;
	        if (!newEntry || !newEntry.historyTrackId) {
	            return;
	        }
	        for (var n = this.historyBackEntries.length - 1; n >= 0; n--) {
	            var oldEntry = this.historyBackEntries[n];
	            if (newEntry.historyTrackId === oldEntry.historyTrackId) {
	                this.historyForwardEntries = this.historyBackEntries.slice(n + 1).concat(this.historyForwardEntries);
	                this.historyBackEntries.splice(n + 1, this.historyBackEntries.length - n);
	                return;
	            }
	        }
	        for (var n = 0; n < this.historyForwardEntries.length; n++) {
	            var oldEntry = this.historyForwardEntries[n];
	            if (newEntry.historyTrackId === oldEntry.historyTrackId) {
	                this.historyBackEntries = this.historyBackEntries.concat(this.historyForwardEntries.slice(0, n + 1));
	                this.historyForwardEntries.splice(0, n + 1);
	                return;
	            }
	        }
	        this.currentHistoryEntry = newEntry;
	        this.historyBackEntries.push(newEntry);
	        if (this.historyBackEntries.length > this.maxHistoryEntries) {
	            var oldEntry = this.historyBackEntries.shift();
	            if (this.disposeHistoryEntryCallback && oldEntry && oldEntry.historyTrackId) {
	                this.disposeHistoryEntryCallback(oldEntry.historyTrackId);
	            }
	        }
	        for (var _i = 0, _a = this.historyForwardEntries; _i < _a.length; _i++) {
	            var oldEntry = _a[_i];
	            if (this.disposeHistoryEntryCallback && oldEntry && oldEntry.historyTrackId) {
	                this.disposeHistoryEntryCallback(oldEntry.historyTrackId);
	            }
	        }
	        this.historyForwardEntries = [];
	    };
	    RouterHistoryManager.prototype.readPopState = function () {
	        if (this.browserHistory.state) {
	            return this.browserHistory.state;
	        }
	        return undefined;
	    };
	    RouterHistoryManager.prototype.writePopState = function (entry) {
	        var url = entry.url;
	        if (this.useHashMode) {
	            url = this.buildFullHashUrl(url);
	        }
	        else {
	            url = this.urlPathPrefix + url;
	        }
	        this.browserHistory.pushState(entry, '', url);
	    };
	    RouterHistoryManager.prototype.rewritePopState = function (entry) {
	        var url = entry.url;
	        if (this.useHashMode) {
	            url = this.buildFullHashUrl(url);
	        }
	        else {
	            url = this.urlPathPrefix + url;
	        }
	        this.browserHistory.replaceState(entry, '', url);
	        return this.browserHistory.state;
	    };
	    RouterHistoryManager.prototype.installEventListener = function (elem, type, listener) {
	        if (elem.addEventListener) {
	            elem.addEventListener(type, listener, false);
	        }
	        else if (elem.attachEvent) {
	            elem.attachEvent('on' + type, listener);
	        }
	    };
	    RouterHistoryManager.prototype.uninstallEventListener = function (eventTarget, type, listener) {
	        if (eventTarget.removeEventListener) {
	            eventTarget.removeEventListener(type, listener, false);
	        }
	        else if (eventTarget.detachEvent) {
	            eventTarget.detachEvent('on' + type, listener);
	        }
	    };
	    RouterHistoryManager.prototype.createHistoryState = function (configPath, url) {
	        var entry = {
	            configPath: configPath,
	            url: url,
	            historyTrackId: this.generateHistoryTrackId()
	        };
	        return entry;
	    };
	    RouterHistoryManager.prototype.generateHistoryTrackId = function () {
	        if (!this.browserStorage) {
	            return undefined;
	        }
	        var trackRoot;
	        var json = this.browserStorage.getItem('routerHistoryTrackRoot');
	        if (json) {
	            trackRoot = JSON.parse(json);
	        }
	        if (!trackRoot) {
	            trackRoot = {
	                nextTrackId: 1
	            };
	        }
	        var trackId = trackRoot.nextTrackId;
	        trackRoot.nextTrackId = trackRoot.nextTrackId + 1;
	        this.browserStorage.setItem('routerHistoryTrackRoot', JSON.stringify(trackRoot));
	        return 'routerHistoryTrack' + trackId;
	    };
	    RouterHistoryManager.prototype.buildFullHashUrl = function (url) {
	        return (this.urlPathPrefix ? this.urlPathPrefix : '/') + '#' + url;
	    };
	    return RouterHistoryManager;
	}());

	var RouterConfigExtensionManager = (function (_super) {
	    __extends(RouterConfigExtensionManager, _super);
	    function RouterConfigExtensionManager(baseConfigPath) {
	        if (baseConfigPath === void 0) { baseConfigPath = ''; }
	        var _this = _super.call(this) || this;
	        if (baseConfigPath) {
	            _this.baseConfigPathParts = baseConfigPath.split('.');
	        }
	        else {
	            _this.baseConfigPathParts = [];
	        }
	        return _this;
	    }
	    RouterConfigExtensionManager.prototype.addConfig = function (configPath, config) {
	        var configPathParts = configPath.split('.');
	        if (configPathParts.length <= this.baseConfigPathParts.length) {
	            throw new RouterException('Extension config path must be longer than base config path: ' + configPath);
	        }
	        for (var n = 0; n < this.baseConfigPathParts.length; n++) {
	            if (this.baseConfigPathParts[n] !== configPathParts[n]) {
	                throw new RouterException('Extension config path must start with base config path: ' + configPath);
	            }
	        }
	        configPathParts.splice(0, this.baseConfigPathParts.length);
	        this.internalAddConfig(configPathParts, config);
	    };
	    RouterConfigExtensionManager.prototype.toExtensionCallbackResult = function () {
	        return this.root.configs || {};
	    };
	    return RouterConfigExtensionManager;
	}(RouterConfigBaseManager));

	exports.Router = Router;
	exports.RouterHistoryManager = RouterHistoryManager;
	exports.RouterConfigManager = RouterConfigManager;
	exports.RouterConfigExtensionManager = RouterConfigExtensionManager;
	exports.RouterStateManager = RouterStateManager;
	exports.RouterException = RouterException;
	exports.RouterNotFoundException = RouterNotFoundException;

	return exports;

}({}));
