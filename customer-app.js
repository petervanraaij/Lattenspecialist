(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // node_modules/@capacitor/core/dist/index.js
  var ExceptionCode, CapacitorException, getPlatformId, createCapacitor, initCapacitorGlobal, Capacitor, registerPlugin, WebPlugin, encode, decode, CapacitorCookiesPluginWeb, CapacitorCookies, readBlobAsBase64, normalizeHttpHeaders, buildUrlParams, buildRequestInit, CapacitorHttpPluginWeb, CapacitorHttp, SystemBarsStyle, SystemBarType, SystemBarsPluginWeb, SystemBars;
  var init_dist = __esm({
    "node_modules/@capacitor/core/dist/index.js"() {
      (function(ExceptionCode2) {
        ExceptionCode2["Unimplemented"] = "UNIMPLEMENTED";
        ExceptionCode2["Unavailable"] = "UNAVAILABLE";
      })(ExceptionCode || (ExceptionCode = {}));
      CapacitorException = class extends Error {
        constructor(message, code, data) {
          super(message);
          this.message = message;
          this.code = code;
          this.data = data;
        }
      };
      getPlatformId = (win) => {
        var _a2, _b;
        if (win === null || win === void 0 ? void 0 : win.androidBridge) {
          return "android";
        } else if ((_b = (_a2 = win === null || win === void 0 ? void 0 : win.webkit) === null || _a2 === void 0 ? void 0 : _a2.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
          return "ios";
        } else {
          return "web";
        }
      };
      createCapacitor = (win) => {
        const capCustomPlatform = win.CapacitorCustomPlatform || null;
        const cap = win.Capacitor || {};
        const Plugins = cap.Plugins = cap.Plugins || {};
        const getPlatform = () => {
          return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
        };
        const isNativePlatform = () => getPlatform() !== "web";
        const isPluginAvailable = (pluginName) => {
          const plugin = registeredPlugins.get(pluginName);
          if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
            return true;
          }
          if (getPluginHeader(pluginName)) {
            return true;
          }
          return false;
        };
        const getPluginHeader = (pluginName) => {
          var _a2;
          return (_a2 = cap.PluginHeaders) === null || _a2 === void 0 ? void 0 : _a2.find((h) => h.name === pluginName);
        };
        const handleError = (err) => win.console.error(err);
        const registeredPlugins = /* @__PURE__ */ new Map();
        const registerPlugin2 = (pluginName, jsImplementations = {}) => {
          const registeredPlugin = registeredPlugins.get(pluginName);
          if (registeredPlugin) {
            console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
            return registeredPlugin.proxy;
          }
          const platform = getPlatform();
          const pluginHeader = getPluginHeader(pluginName);
          let jsImplementation;
          const loadPluginImplementation = async () => {
            if (!jsImplementation && platform in jsImplementations) {
              jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
            } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
              jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
            }
            return jsImplementation;
          };
          const createPluginMethod = (impl, prop) => {
            var _a2, _b;
            if (pluginHeader) {
              const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
              if (methodHeader) {
                if (methodHeader.rtype === "promise") {
                  return (options) => cap.nativePromise(pluginName, prop.toString(), options);
                } else {
                  return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
                }
              } else if (impl) {
                return (_a2 = impl[prop]) === null || _a2 === void 0 ? void 0 : _a2.bind(impl);
              }
            } else if (impl) {
              return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
            } else {
              throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, ExceptionCode.Unimplemented);
            }
          };
          const createPluginMethodWrapper = (prop) => {
            let remove;
            const wrapper = (...args) => {
              const p = loadPluginImplementation().then((impl) => {
                const fn = createPluginMethod(impl, prop);
                if (fn) {
                  const p2 = fn(...args);
                  remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
                  return p2;
                } else {
                  throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, ExceptionCode.Unimplemented);
                }
              });
              if (prop === "addListener") {
                p.remove = async () => remove();
              }
              return p;
            };
            wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
            Object.defineProperty(wrapper, "name", {
              value: prop,
              writable: false,
              configurable: false
            });
            return wrapper;
          };
          const addListener = createPluginMethodWrapper("addListener");
          const removeListener = createPluginMethodWrapper("removeListener");
          const addListenerNative = (eventName, callback) => {
            const call = addListener({ eventName }, callback);
            const remove = async () => {
              const callbackId = await call;
              removeListener({
                eventName,
                callbackId
              }, callback);
            };
            const p = new Promise((resolve) => call.then(() => resolve({ remove })));
            p.remove = async () => {
              console.warn(`Using addListener() without 'await' is deprecated.`);
              await remove();
            };
            return p;
          };
          const proxy = new Proxy({}, {
            get(_, prop) {
              switch (prop) {
                // https://github.com/facebook/react/issues/20030
                case "$$typeof":
                  return void 0;
                case "toJSON":
                  return () => ({});
                case "addListener":
                  return pluginHeader ? addListenerNative : addListener;
                case "removeListener":
                  return removeListener;
                default:
                  return createPluginMethodWrapper(prop);
              }
            }
          });
          Plugins[pluginName] = proxy;
          registeredPlugins.set(pluginName, {
            name: pluginName,
            proxy,
            platforms: /* @__PURE__ */ new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
          });
          return proxy;
        };
        if (!cap.convertFileSrc) {
          cap.convertFileSrc = (filePath) => filePath;
        }
        cap.getPlatform = getPlatform;
        cap.handleError = handleError;
        cap.isNativePlatform = isNativePlatform;
        cap.isPluginAvailable = isPluginAvailable;
        cap.registerPlugin = registerPlugin2;
        cap.Exception = CapacitorException;
        cap.DEBUG = !!cap.DEBUG;
        cap.isLoggingEnabled = !!cap.isLoggingEnabled;
        return cap;
      };
      initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
      Capacitor = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
      registerPlugin = Capacitor.registerPlugin;
      WebPlugin = class {
        constructor() {
          this.listeners = {};
          this.retainedEventArguments = {};
          this.windowListeners = {};
        }
        addListener(eventName, listenerFunc) {
          let firstListener = false;
          const listeners = this.listeners[eventName];
          if (!listeners) {
            this.listeners[eventName] = [];
            firstListener = true;
          }
          this.listeners[eventName].push(listenerFunc);
          const windowListener = this.windowListeners[eventName];
          if (windowListener && !windowListener.registered) {
            this.addWindowListener(windowListener);
          }
          if (firstListener) {
            this.sendRetainedArgumentsForEvent(eventName);
          }
          const remove = async () => this.removeListener(eventName, listenerFunc);
          const p = Promise.resolve({ remove });
          return p;
        }
        async removeAllListeners() {
          this.listeners = {};
          for (const listener in this.windowListeners) {
            this.removeWindowListener(this.windowListeners[listener]);
          }
          this.windowListeners = {};
        }
        notifyListeners(eventName, data, retainUntilConsumed) {
          const listeners = this.listeners[eventName];
          if (!listeners) {
            if (retainUntilConsumed) {
              let args = this.retainedEventArguments[eventName];
              if (!args) {
                args = [];
              }
              args.push(data);
              this.retainedEventArguments[eventName] = args;
            }
            return;
          }
          listeners.forEach((listener) => listener(data));
        }
        hasListeners(eventName) {
          var _a2;
          return !!((_a2 = this.listeners[eventName]) === null || _a2 === void 0 ? void 0 : _a2.length);
        }
        registerWindowListener(windowEventName, pluginEventName) {
          this.windowListeners[pluginEventName] = {
            registered: false,
            windowEventName,
            pluginEventName,
            handler: (event) => {
              this.notifyListeners(pluginEventName, event);
            }
          };
        }
        unimplemented(msg = "not implemented") {
          return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
        }
        unavailable(msg = "not available") {
          return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
        }
        async removeListener(eventName, listenerFunc) {
          const listeners = this.listeners[eventName];
          if (!listeners) {
            return;
          }
          const index = listeners.indexOf(listenerFunc);
          if (index !== -1) {
            this.listeners[eventName].splice(index, 1);
          }
          if (!this.listeners[eventName].length) {
            this.removeWindowListener(this.windowListeners[eventName]);
          }
        }
        addWindowListener(handle) {
          window.addEventListener(handle.windowEventName, handle.handler);
          handle.registered = true;
        }
        removeWindowListener(handle) {
          if (!handle) {
            return;
          }
          window.removeEventListener(handle.windowEventName, handle.handler);
          handle.registered = false;
        }
        sendRetainedArgumentsForEvent(eventName) {
          const args = this.retainedEventArguments[eventName];
          if (!args) {
            return;
          }
          delete this.retainedEventArguments[eventName];
          args.forEach((arg) => {
            this.notifyListeners(eventName, arg);
          });
        }
      };
      encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
      decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
      CapacitorCookiesPluginWeb = class extends WebPlugin {
        async getCookies() {
          const cookies = document.cookie;
          const cookieMap = {};
          cookies.split(";").forEach((cookie) => {
            if (cookie.length <= 0)
              return;
            let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
            key = decode(key).trim();
            value = decode(value).trim();
            cookieMap[key] = value;
          });
          return cookieMap;
        }
        async setCookie(options) {
          try {
            const encodedKey = encode(options.key);
            const encodedValue = encode(options.value);
            const expires = options.expires ? `; expires=${options.expires.replace("expires=", "")}` : "";
            const path = (options.path || "/").replace("path=", "");
            const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
            document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
          } catch (error) {
            return Promise.reject(error);
          }
        }
        async deleteCookie(options) {
          try {
            document.cookie = `${options.key}=; Max-Age=0`;
          } catch (error) {
            return Promise.reject(error);
          }
        }
        async clearCookies() {
          try {
            const cookies = document.cookie.split(";") || [];
            for (const cookie of cookies) {
              document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
            }
          } catch (error) {
            return Promise.reject(error);
          }
        }
        async clearAllCookies() {
          try {
            await this.clearCookies();
          } catch (error) {
            return Promise.reject(error);
          }
        }
      };
      CapacitorCookies = registerPlugin("CapacitorCookies", {
        web: () => new CapacitorCookiesPluginWeb()
      });
      readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result;
          resolve(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(blob);
      });
      normalizeHttpHeaders = (headers = {}) => {
        const originalKeys = Object.keys(headers);
        const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
        const normalized = loweredKeys.reduce((acc, key, index) => {
          acc[key] = headers[originalKeys[index]];
          return acc;
        }, {});
        return normalized;
      };
      buildUrlParams = (params, shouldEncode = true) => {
        if (!params)
          return null;
        const output = Object.entries(params).reduce((accumulator, entry) => {
          const [key, value] = entry;
          let encodedValue;
          let item;
          if (Array.isArray(value)) {
            item = "";
            value.forEach((str) => {
              encodedValue = shouldEncode ? encodeURIComponent(str) : str;
              item += `${key}=${encodedValue}&`;
            });
            item.slice(0, -1);
          } else {
            encodedValue = shouldEncode ? encodeURIComponent(value) : value;
            item = `${key}=${encodedValue}`;
          }
          return `${accumulator}&${item}`;
        }, "");
        return output.substr(1);
      };
      buildRequestInit = (options, extra = {}) => {
        const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
        const headers = normalizeHttpHeaders(options.headers);
        const type = headers["content-type"] || "";
        if (typeof options.data === "string") {
          output.body = options.data;
        } else if (type.includes("application/x-www-form-urlencoded")) {
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(options.data || {})) {
            params.set(key, value);
          }
          output.body = params.toString();
        } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
          const form = new FormData();
          if (options.data instanceof FormData) {
            options.data.forEach((value, key) => {
              form.append(key, value);
            });
          } else {
            for (const key of Object.keys(options.data)) {
              form.append(key, options.data[key]);
            }
          }
          output.body = form;
          const headers2 = new Headers(output.headers);
          headers2.delete("content-type");
          output.headers = headers2;
        } else if (type.includes("application/json") || typeof options.data === "object") {
          output.body = JSON.stringify(options.data);
        }
        return output;
      };
      CapacitorHttpPluginWeb = class extends WebPlugin {
        /**
         * Perform an Http request given a set of options
         * @param options Options to build the HTTP request
         */
        async request(options) {
          const requestInit = buildRequestInit(options, options.webFetchExtra);
          const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
          const url = urlParams ? `${options.url}?${urlParams}` : options.url;
          const response = await fetch(url, requestInit);
          const contentType = response.headers.get("content-type") || "";
          let { responseType = "text" } = response.ok ? options : {};
          if (contentType.includes("application/json")) {
            responseType = "json";
          }
          let data;
          let blob;
          switch (responseType) {
            case "arraybuffer":
            case "blob":
              blob = await response.blob();
              data = await readBlobAsBase64(blob);
              break;
            case "json":
              data = await response.json();
              break;
            case "document":
            case "text":
            default:
              data = await response.text();
          }
          const headers = {};
          response.headers.forEach((value, key) => {
            headers[key] = value;
          });
          return {
            data,
            headers,
            status: response.status,
            url: response.url
          };
        }
        /**
         * Perform an Http GET request given a set of options
         * @param options Options to build the HTTP request
         */
        async get(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
        }
        /**
         * Perform an Http POST request given a set of options
         * @param options Options to build the HTTP request
         */
        async post(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
        }
        /**
         * Perform an Http PUT request given a set of options
         * @param options Options to build the HTTP request
         */
        async put(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
        }
        /**
         * Perform an Http PATCH request given a set of options
         * @param options Options to build the HTTP request
         */
        async patch(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
        }
        /**
         * Perform an Http DELETE request given a set of options
         * @param options Options to build the HTTP request
         */
        async delete(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
        }
      };
      CapacitorHttp = registerPlugin("CapacitorHttp", {
        web: () => new CapacitorHttpPluginWeb()
      });
      (function(SystemBarsStyle2) {
        SystemBarsStyle2["Dark"] = "DARK";
        SystemBarsStyle2["Light"] = "LIGHT";
        SystemBarsStyle2["Default"] = "DEFAULT";
      })(SystemBarsStyle || (SystemBarsStyle = {}));
      (function(SystemBarType2) {
        SystemBarType2["StatusBar"] = "StatusBar";
        SystemBarType2["NavigationBar"] = "NavigationBar";
      })(SystemBarType || (SystemBarType = {}));
      SystemBarsPluginWeb = class extends WebPlugin {
        async setStyle() {
          this.unavailable("not available for web");
        }
        async setAnimation() {
          this.unavailable("not available for web");
        }
        async show() {
          this.unavailable("not available for web");
        }
        async hide() {
          this.unavailable("not available for web");
        }
      };
      SystemBars = registerPlugin("SystemBars", {
        web: () => new SystemBarsPluginWeb()
      });
    }
  });

  // node_modules/@capacitor/app/dist/esm/web.js
  var web_exports = {};
  __export(web_exports, {
    AppWeb: () => AppWeb
  });
  var AppWeb;
  var init_web = __esm({
    "node_modules/@capacitor/app/dist/esm/web.js"() {
      init_dist();
      AppWeb = class extends WebPlugin {
        constructor() {
          super();
          this.handleVisibilityChange = () => {
            const data = {
              isActive: document.hidden !== true
            };
            this.notifyListeners("appStateChange", data);
            if (document.hidden) {
              this.notifyListeners("pause", null);
            } else {
              this.notifyListeners("resume", null);
            }
          };
          document.addEventListener("visibilitychange", this.handleVisibilityChange, false);
        }
        exitApp() {
          throw this.unimplemented("Not implemented on web.");
        }
        async getInfo() {
          throw this.unimplemented("Not implemented on web.");
        }
        async getLaunchUrl() {
          return { url: "" };
        }
        async getState() {
          return { isActive: document.hidden !== true };
        }
        async minimizeApp() {
          throw this.unimplemented("Not implemented on web.");
        }
        async toggleBackButtonHandler() {
          throw this.unimplemented("Not implemented on web.");
        }
        async getAppLanguage() {
          return {
            value: navigator.language.split("-")[0].toLowerCase()
          };
        }
      };
    }
  });

  // node_modules/@capacitor/browser/dist/esm/web.js
  var web_exports2 = {};
  __export(web_exports2, {
    Browser: () => Browser,
    BrowserWeb: () => BrowserWeb
  });
  var BrowserWeb, Browser;
  var init_web2 = __esm({
    "node_modules/@capacitor/browser/dist/esm/web.js"() {
      init_dist();
      BrowserWeb = class extends WebPlugin {
        constructor() {
          super();
          this._lastWindow = null;
        }
        async open(options) {
          this._lastWindow = window.open(options.url, options.windowName || "_blank");
        }
        async close() {
          return new Promise((resolve, reject) => {
            if (this._lastWindow != null) {
              this._lastWindow.close();
              this._lastWindow = null;
              resolve();
            } else {
              reject("No active window to close!");
            }
          });
        }
      };
      Browser = new BrowserWeb();
    }
  });

  // src/customer.js
  init_dist();

  // node_modules/@capacitor/app/dist/esm/index.js
  init_dist();
  var App = registerPlugin("App", {
    web: () => Promise.resolve().then(() => (init_web(), web_exports)).then((m) => new m.AppWeb())
  });

  // node_modules/@capacitor/browser/dist/esm/index.js
  init_dist();
  var Browser2 = registerPlugin("Browser", {
    web: () => Promise.resolve().then(() => (init_web2(), web_exports2)).then((m) => new m.BrowserWeb())
  });

  // src/domain.js
  var SITE = true ? window.location.origin : "https://lattenspecialist.nl";
  var STEPS = ["Aanvraag ontvangen", "Ophalen of brengen gepland", "Materiaal ontvangen", "Inspectie uitgevoerd", "Onderhoud gestart", "Wax koelt af", "Finish en eindcontrole", "Klaar voor ophalen of terugbrengen"];
  var CONDITIONS = ["Weet ik nog niet", "Zacht / warm", "Rond het vriespunt", "Koud", "Kunstsneeuw / hard / ijzig"];
  var normalizeCode = (value) => String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  var validCode = (value) => /^LS-[A-Z2-9]{6}$/.test(value);
  var escape2 = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var today = () => {
    const date = /* @__PURE__ */ new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  var validDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = /* @__PURE__ */ new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  function readTrip(raw) {
    if (!raw || typeof raw !== "object") return null;
    const destination = String(raw.destination || "").trim().slice(0, 100);
    const skidate = String(raw.skidate || "");
    if (!destination || !validDate(skidate)) return null;
    return { destination, skidate, conditions: CONDITIONS.includes(raw.conditions) ? raw.conditions : CONDITIONS[0] };
  }
  function formatDate(value) {
    const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" }).format(date);
  }
  function renderStatus(record) {
    const step = Math.max(1, Math.min(STEPS.length, Number(record.currentStep) || 1));
    const progress = record.closed ? '<p class="status-note">Deze aanvraag is afgemeld. Neem bij vragen contact met ons op.</p>' : `<ol class="status-steps">${STEPS.map((label, i) => `<li class="${i + 1 < step ? "done" : i + 1 === step ? "current" : ""}"><span>${i + 1 < step ? "\u2713" : i + 1}</span>${escape2(label)}</li>`).join("")}</ol>`;
    return `<article class="card"><div class="status-label"><span>${escape2(record.code)}</span><span>${record.closed ? "Afgemeld" : `Stap ${step} van ${STEPS.length}`}</span></div><h2>${escape2(record.material || "Jouw materiaal")}</h2><p>${escape2(record.status || STEPS[step - 1])}</p>${progress}<dl class="status-details"><div><dt>Pakket</dt><dd>${escape2(record.package || "In overleg")}</dd></div><div><dt>Verwacht klaar</dt><dd>${escape2(record.expectedReady ? formatDate(record.expectedReady) : "Nog niet gepland")}</dd></div><div><dt>Gekozen wax</dt><dd>${escape2(record.waxType || "Nog te bepalen")}</dd></div><div><dt>Laatst bijgewerkt</dt><dd>${escape2(record.updatedAt ? formatDate(record.updatedAt) : "Nog niet bekend")}</dd></div></dl>${record.note ? `<p class="status-note">${escape2(record.note)}</p>` : ""}<button class="text-button" type="button" id="refreshStatus">Voortgang vernieuwen</button></article>`;
  }

  // src/customer.js
  var _a;
  var endpoint = String(((_a = window.LATTENSPECIALIST_BOOKING) == null ? void 0 : _a.endpoint) || "").replace(/\/$/, "");
  var $ = (id) => document.getElementById(id);
  var CODE_KEY = "lattenspecialist-customer-code";
  var TRIP_KEY = "lattenspecialist-customer-trip";
  var storage = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch {
      }
    }
  };
  var currentCode = "";
  var statusRequest = 0;
  var offersRequest = 0;
  var activeScreen = "home";
  var bookingStarted = false;
  var bookingReady = false;
  var bookingTimer;
  var bookingPrefill = null;
  var frame = $("bookingFrame");
  var pages = ["home", "onderhoud", "aanvragen", "aanbod", "reis"];
  var fail = (message) => `<div class="card"><p class="error">${escape2(message)}</p></div>`;
  async function fetchResource(url, json = true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12e3);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal, credentials: "omit" });
      if (!response.ok) {
        const error = new Error("Ophalen mislukt");
        error.status = response.status;
        throw error;
      }
      return json ? await response.json() : await response.text();
    } finally {
      clearTimeout(timer);
    }
  }
  function updateSavedCode() {
    const saved = normalizeCode(storage.get(CODE_KEY));
    $("savedCodeArea").hidden = !validCode(saved);
    $("savedCodeLabel").textContent = validCode(saved) ? `Bewaard op dit toestel: ${saved}` : "";
  }
  async function loadStatus(code) {
    const request = ++statusRequest;
    $("statusResult").innerHTML = '<div class="empty"><p>Je actuele voortgang wordt opgehaald\u2026</p></div>';
    $("statusSubmit").disabled = true;
    try {
      if (!validCode(code) || !endpoint) throw new Error("Ongeldige code");
      const data = await fetchResource(`${endpoint}/api/status/${encodeURIComponent(code)}`);
      if (request !== statusRequest) return;
      if (!data.record || normalizeCode(data.record.code) !== code) throw new Error("Ongeldig antwoord");
      currentCode = code;
      $("statusResult").innerHTML = renderStatus(data.record);
      $("refreshStatus").addEventListener("click", () => loadStatus(currentCode));
      if ($("rememberCode").checked) {
        const ok = storage.set(CODE_KEY, code);
        $("codeFeedback").textContent = ok ? "" : "Je toestel kon de code niet bewaren. De status is wel opgehaald.";
      } else storage.remove(CODE_KEY);
      updateSavedCode();
    } catch (error) {
      if (request !== statusRequest) return;
      const missing = error.status === 404 || error.status === 400;
      $("statusResult").innerHTML = fail(missing ? "Deze onderhoudscode is niet gevonden. Controleer de code uit je bericht; je aanvraagcode is een andere code." : "Je actuele voortgang kon niet worden opgehaald. Controleer je internetverbinding en probeer het opnieuw.");
    } finally {
      if (request === statusRequest) $("statusSubmit").disabled = false;
    }
  }
  $("statusForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const code = normalizeCode($("serviceCode").value);
    $("serviceCode").value = code;
    if (!validCode(code)) {
      ++statusRequest;
      currentCode = "";
      $("statusSubmit").disabled = false;
      $("statusResult").innerHTML = "";
      $("codeFeedback").textContent = "Gebruik je onderhoudscode: LS- met 6 letters of cijfers. Een aanvraagcode (LS-2609-\u2026) werkt hier niet.";
      return;
    }
    $("codeFeedback").textContent = "";
    currentCode = code;
    if (storage.get(CODE_KEY) !== code) {
      storage.remove(CODE_KEY);
      updateSavedCode();
    }
    loadStatus(code);
  });
  $("forgetCode").addEventListener("click", () => {
    ++statusRequest;
    storage.remove(CODE_KEY);
    currentCode = "";
    $("serviceCode").value = "";
    $("rememberCode").checked = false;
    $("statusSubmit").disabled = false;
    $("statusResult").innerHTML = "";
    $("codeFeedback").textContent = "De code en getoonde voortgang zijn van dit toestel verwijderd.";
    updateSavedCode();
  });
  $("rememberCode").addEventListener("change", () => {
    if (!$("rememberCode").checked) {
      storage.remove(CODE_KEY);
      updateSavedCode();
    }
  });
  async function loadDates() {
    try {
      const data = await fetchResource(`${endpoint}/api/availability`);
      const dates = Array.isArray(data.dates) ? data.dates.filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x) && x >= today()) : [];
      $("pickupDates").textContent = dates.length ? dates.slice(0, 3).map(formatDate).join(" \xB7 ") : "We stemmen de eerstvolgende mogelijkheid graag met je af.";
    } catch {
      $("pickupDates").textContent = "De data konden niet worden opgehaald. Controleer ze in het aanvraagformulier.";
    }
  }
  function loadBooking() {
    clearTimeout(bookingTimer);
    bookingStarted = true;
    bookingReady = false;
    frame.hidden = false;
    $("bookingLoadStatus").textContent = "Het aanvraagformulier wordt geladen\u2026";
    frame.src = `${SITE}/?app=klant`;
    bookingTimer = setTimeout(() => {
      if (!bookingReady) $("bookingLoadStatus").textContent = "Het formulier reageert nog niet. Controleer je verbinding, laad opnieuw of gebruik de link naar de website hieronder.";
    }, 15e3);
  }
  frame.addEventListener("load", () => {
    var _a2;
    return (_a2 = frame.contentWindow) == null ? void 0 : _a2.postMessage({ type: "lattenspecialist:hello" }, SITE);
  });
  function sendPrefill() {
    if (bookingReady && bookingPrefill) {
      frame.contentWindow.postMessage({ type: "lattenspecialist:prefill", values: bookingPrefill }, SITE);
      bookingPrefill = null;
    }
  }
  window.addEventListener("message", (event) => {
    if (event.origin !== SITE || event.source !== frame.contentWindow || !event.data || typeof event.data !== "object") return;
    if (event.data.type === "lattenspecialist:ready") {
      bookingReady = true;
      clearTimeout(bookingTimer);
      frame.hidden = false;
      $("bookingLoadStatus").textContent = "";
      sendPrefill();
    }
    if (event.data.type === "lattenspecialist:height" && Number.isFinite(event.data.height)) frame.style.height = `${Math.max(600, Math.min(1e4, event.data.height))}px`;
    if (event.data.type === "lattenspecialist:booked" && /^LS-\d{4}-[A-Z2-9]{6}$/.test(event.data.reference || "")) {
      $("bookingLoadStatus").textContent = `Aanvraag ontvangen: ${event.data.reference}. De planning wordt persoonlijk bevestigd.`;
      $("bookingLoadStatus").scrollIntoView({ block: "center" });
    }
    if (event.data.type === "lattenspecialist:external") {
      try {
        const url = new URL(event.data.url);
        if (url.origin === SITE && ["/privacy.html", "/service.html"].includes(url.pathname)) openExternal(url.href);
      } catch {
      }
    }
  });
  $("reloadBooking").addEventListener("click", loadBooking);
  function requestBooking(values) {
    bookingPrefill = values;
    if (activeScreen === "aanvragen") sendPrefill();
    else location.hash = "aanvragen";
  }
  $("requestRental").addEventListener("click", () => requestBooking({ service: "Verhuur" }));
  async function loadOffers() {
    const request = ++offersRequest;
    $("packages").innerHTML = "<p>Pakketten ophalen\u2026</p>";
    $("inventory").innerHTML = "<p>Verhuuraanbod ophalen\u2026</p>";
    await Promise.allSettled([
      (async () => {
        try {
          const html = await fetchResource(`${SITE}/`, false);
          if (request !== offersRequest) return;
          const site = new DOMParser().parseFromString(html, "text/html");
          const cards = [...site.querySelectorAll("#pakketten .package-card")];
          if (!cards.length) throw new Error();
          $("packages").innerHTML = cards.map((card) => {
            var _a2, _b;
            const tier = ((_a2 = card.querySelector(".tier")) == null ? void 0 : _a2.textContent.trim()) || "";
            const name = ((_b = card.querySelector("h3")) == null ? void 0 : _b.textContent) || tier;
            const prices = [...card.querySelectorAll(".price-row > div")].map((p) => {
              var _a3, _b2;
              return `<div><small>${escape2((_a3 = p.querySelector("small")) == null ? void 0 : _a3.textContent)}</small><strong>${escape2((_b2 = p.querySelector("strong")) == null ? void 0 : _b2.textContent)}</strong></div>`;
            }).join("");
            const points = [...card.querySelectorAll("li")].map((li) => `<li>${escape2(li.textContent)}</li>`).join("");
            return `<article class="card"><span class="tag">${escape2(tier)}</span><h2>${escape2(name)}</h2><div class="price-row">${prices}</div><ul class="package-features">${points}</ul><p class="muted">Inclusief btw.</p><button class="button dark" type="button" data-package="${escape2(tier)}">${escape2(tier)} aanvragen</button></article>`;
          }).join("");
        } catch {
          if (request === offersRequest) $("packages").innerHTML = fail("De actuele pakketten en prijzen zijn niet bereikbaar. Vernieuw het aanbod of bekijk de website.");
        }
      })(),
      (async () => {
        try {
          const data = await fetchResource(`${SITE}/data/aanbod.json`);
          if (request !== offersRequest) return;
          if (!Array.isArray(data.items)) throw new Error();
          $("inventory").innerHTML = data.items.length ? data.items.map((item) => `<article class="card"><span class="eyebrow">${escape2(item.type)}</span><h3>${escape2(item.title)}</h3><p>${escape2(item.details)}</p><span class="availability ${item.available ? "" : "unavailable"}">${item.available ? "Beschikbaar" : "Verhuurd"}</span></article>`).join("") : '<div class="card"><h3>Wat heb je nodig?</h3><p>Er staat nu geen vast openbaar aanbod online. Geef je maat, niveau en reisperiode door. We bekijken wat beschikbaar is of geregeld kan worden.</p></div>';
        } catch {
          if (request === offersRequest) $("inventory").innerHTML = fail("Het actuele verhuuraanbod is tijdelijk niet beschikbaar. Je kunt wel een aanvraag doen.");
        }
      })()
    ]);
  }
  $("packages").addEventListener("click", (event) => {
    const button = event.target.closest("[data-package]");
    if (button) requestBooking({ service: "Onderhoud", package: button.dataset.package });
  });
  $("refreshOffers").addEventListener("click", loadOffers);
  function getSavedTrip() {
    try {
      return readTrip(JSON.parse(storage.get(TRIP_KEY)));
    } catch {
      return null;
    }
  }
  function showTrip(trip, saved = true) {
    $("tripResult").hidden = false;
    const weather = `https://www.google.com/search?q=${encodeURIComponent(`weer sneeuw ${trip.destination} skigebied`)}`;
    $("tripResult").innerHTML = `<span class="tag">${saved ? "Bewaard op dit toestel" : "Reis ingevuld"}</span><h2>${escape2(trip.destination)}</h2><p>Eerste skidag: ${escape2(formatDate(trip.skidate))}</p><p>${escape2(trip.conditions)}</p>${trip.skidate < today() ? '<p class="error">Deze reisdatum is voorbij. Pas de datum aan voor een nieuwe aanvraag.</p>' : ""}<a class="text-link" href="${escape2(weather)}">Bekijk weer en sneeuwverwachting \u2197</a>`;
  }
  $("skiDate").min = today();
  var savedTrip = getSavedTrip();
  if (savedTrip) {
    for (const [name, value] of Object.entries(savedTrip)) $("tripForm").elements[name].value = value;
    showTrip(savedTrip);
  }
  $("tripForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const trip = readTrip(Object.fromEntries(new FormData($("tripForm"))));
    if (trip) showTrip(trip, storage.set(TRIP_KEY, JSON.stringify(trip)));
  });
  $("tripBooking").addEventListener("click", () => {
    if (!$("tripForm").reportValidity()) return;
    const trip = readTrip(Object.fromEntries(new FormData($("tripForm"))));
    if (trip) requestBooking({ ...trip, service: "Onderhoud" });
  });
  $("clearTrip").addEventListener("click", () => {
    storage.remove(TRIP_KEY);
    $("tripForm").reset();
    $("tripResult").hidden = false;
    $("tripResult").textContent = "De reis is van dit toestel verwijderd.";
  });
  async function openExternal(url) {
    try {
      if (Capacitor.isNativePlatform()) await Browser2.open({ url, toolbarColor: "#0b0b0c" });
      else window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      $("offlineNotice").hidden = false;
      $("offlineNotice").textContent = "De link kon niet worden geopend. Probeer het opnieuw.";
    }
  }
  document.addEventListener("click", (event) => {
    const a = event.target.closest('a[href^="https://"]');
    if (!a) return;
    event.preventDefault();
    openExternal(a.href);
  });
  function navigate(focus = true) {
    var _a2;
    const hash = location.hash.slice(1);
    const page = { status: "onderhoud", waxplanner: "reis" }[hash] || hash;
    activeScreen = pages.includes(page) ? page : "home";
    for (const id of pages) $(id).hidden = id !== activeScreen;
    for (const link of document.querySelectorAll(".bottom-nav a")) {
      if (link.hash === `#${activeScreen}`) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    if (focus) {
      window.scrollTo(0, 0);
      (_a2 = $(activeScreen).querySelector("h1")) == null ? void 0 : _a2.focus({ preventScroll: true });
    }
    if (activeScreen === "home") loadDates();
    if (activeScreen === "onderhoud" && currentCode) loadStatus(currentCode);
    if (activeScreen === "aanvragen") {
      if (!bookingStarted) loadBooking();
      else sendPrefill();
    }
    if (activeScreen === "aanbod") loadOffers();
  }
  window.addEventListener("hashchange", () => navigate());
  var savedCode = normalizeCode(storage.get(CODE_KEY));
  if (validCode(savedCode)) {
    currentCode = savedCode;
    $("serviceCode").value = savedCode;
    $("rememberCode").checked = true;
  }
  updateSavedCode();
  function updateConnection() {
    $("offlineNotice").hidden = navigator.onLine;
    if (!navigator.onLine) $("offlineNotice").textContent = "Je bent offline. Voor actuele voortgang, aanbod en aanvragen is internet nodig.";
  }
  window.addEventListener("online", () => {
    updateConnection();
    if (activeScreen === "onderhoud" && currentCode) loadStatus(currentCode);
    if (activeScreen === "home") loadDates();
  });
  window.addEventListener("offline", updateConnection);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && activeScreen === "onderhoud" && currentCode) loadStatus(currentCode);
  });
  if (Capacitor.isNativePlatform()) {
    App.addListener("backButton", () => {
      if (activeScreen !== "home") location.hash = "home";
      else App.exitApp();
    });
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive && activeScreen === "onderhoud" && currentCode) loadStatus(currentCode);
    });
  }
  updateConnection();
  navigate(false);
})();
/*! Bundled license information:

@capacitor/core/dist/index.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)
*/
