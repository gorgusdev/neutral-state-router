// Copyright (c) 2016 Göran Gustafsson. All rights reserved.  
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

import extend = require('extend');
import pathToRegexp = require('path-to-regexp');
import queryString = require('query-string');
import urllite = require('urllite');
import { Promise } from 'es6-promise';

import {
	RouterStateData, RouterUrlParams, RouterQueryParams, RouterState,
	RouterConfigMap, RouterConfig,
	RouteFoundCallback, RouteNotFoundCallback, UrlMissingRouteCallback,
	TransitionBeginCallback, TransitionCancelCallback, TransitionEndCallback
} from './router-types';
import { RouterHistory } from './router-history';
import { RouterException } from './router-exception';
import { RouterNotFoundException } from './router-not-found-exception';

interface RouterConfigInternal extends RouterConfig {
	routeExtensionPromise?: Thenable<RouterConfig>;
	routeExtended?: boolean;
	pathPrefixRegExp?: RegExp;
	pathPrefixParams?: PathToRegExpKey[];
	pathRegExp?: RegExp;
	pathBuildFunc?: (params: any) => string;
	pathParams?: PathToRegExpKey[];
}

interface RouterConfigMatch {
	configPath: string;
	pathMatches: RegExpExecArray;
	configMatches: RouterConfig[];
	prefixMatch: boolean;
}

export class Router {

	private history: RouterHistory;
	private routeFoundCallback: RouteFoundCallback;
	private routeNotFoundCallback: RouteNotFoundCallback;
	private urlMissingRouteCallback: UrlMissingRouteCallback;
	private transitionBegin: TransitionBeginCallback;
	private transitionCancel: TransitionCancelCallback;
	private transitionEnd: TransitionEndCallback;
	private running: boolean;
	protected rootConfig: RouterConfig;
	
	private pendingReload: boolean;
	
	private currentState: RouterState;
	private currentStateDatas: RouterStateData[];
	private currentConfigs: RouterConfig[];

	private transitionId: number;
	private lastDoneTransitionId: number;
	
	constructor() {
		this.rootConfig = {
			unrouted: true,
			configs: {}
		};
		this.currentState = {
			configPath: '',
			url: '',
			urlParams: {},
			queryParams: {},
			historyTrackId: null,
			data: {}
		};
		this.currentStateDatas = [];
		this.currentConfigs = [];
		this.transitionId = 0;
		this.lastDoneTransitionId = 0;
		this.buildRouterConfigUrlPrefix(this.rootConfig, '', true);
	}
	
	getCurrentState(): RouterState {
		return this.currentState;
	}

	isRunning(): boolean {
		return this.running;
	}
	
	requestReload() {
		this.pendingReload = true;
	}
	
	addConfig(configPath: string, config: RouterConfig) {
		var configPathParts: string[] = configPath.split('.');
		var parentConfig: RouterConfig = this.rootConfig;
		for(var n = 0; n < configPathParts.length; n++) {
			var configPathPart = configPathParts[n];
			var currentConfig = parentConfig.configs[configPathPart];
			if(!currentConfig) {
				currentConfig = {
					configs: {}
				};
				parentConfig.configs[configPathPart] = currentConfig;
			}
			if(n === configPathParts.length - 1) {
				break;
			}
			parentConfig = currentConfig;
		}
		parentConfig.configs[configPathPart] = extend(true, currentConfig, config);
		if(this.isRunning()) {
			this.buildRouterConfigs();
		}
	}
	
	start(history: RouterHistory, routeFoundCallback: RouteFoundCallback, routeNotFoundCallback?: RouteNotFoundCallback, urlMissingRouteCallback?: UrlMissingRouteCallback, transitionBegin?: TransitionBeginCallback, transitionCancel?: TransitionCancelCallback, transitionEnd?: TransitionEndCallback) {
		if(this.isRunning()) {
			throw new RouterException("Router already running");
		}
		this.history = history;
		this.routeFoundCallback = routeFoundCallback;
		this.routeNotFoundCallback = routeNotFoundCallback;
		this.urlMissingRouteCallback = urlMissingRouteCallback;
		this.transitionBegin = transitionBegin;
		this.transitionCancel = transitionCancel;
		this.transitionEnd = transitionEnd;
		this.history.startHistoryUpdates(this.updateUrl);
		this.buildRouterConfigs();
		this.running = true;
		this.history.init();
	}
	
	stop() {
		if(this.isRunning()) {
			this.history.stopHistoryUpdates();
		}
		this.running = false;
	}
	
	navigateTo(configPath: string, urlParams?: RouterUrlParams, queryParams?: RouterQueryParams): Thenable<RouterState> {
		if(!this.isRunning()) {
			throw new RouterException('Router is not running');
		}
		var transitionIdSnapshot = this.beginNewTransition();
		return new Promise<RouterState>((resolve, reject) => {
			var configPathParts: string[] = configPath.split('.');
			this.findRouterConfigByName(configPathParts, 0, this.rootConfig, []).then((configs) => {
				if(this.isTransitionCancelled(transitionIdSnapshot)) {
					return;
				}
				var newConfig: RouterConfigInternal = configs[configs.length - 1];
				if(newConfig.unrouted) {
					throw new RouterNotFoundException('Unable to navigate to unrouted path: ' + configPath, configs);
				}
				urlParams = urlParams || {};
				queryParams = queryParams || {};
				var url = this.buildConfigStateUrl(configs, urlParams, queryParams);
				if(this.pendingReload && newConfig.url && newConfig.reloadable) {
					this.history.reloadAtUrl(url);
				}
				this.history.navigateTo(configPath, url);
				var historyTrackId = this.history.getHistoryTrackId();
				this.updateState(configPath, url, urlParams, queryParams, historyTrackId, configs);
				if(this.routeFoundCallback) {
					this.routeFoundCallback(this.currentState);
				}
				this.endCurrentTransition();
				resolve(this.currentState);
			}).then(undefined, (error) => {
				this.fireRouteNotFoundCallback(error, configPath, null, urlParams, queryParams);
				this.transitionCancel(transitionIdSnapshot);
				reject(error);
			});
		});
	}
	
	private beginNewTransition(): number {
		if(this.lastDoneTransitionId < this.transitionId) {
			if(this.transitionCancel) {
				this.transitionCancel(this.transitionId);
			}
			this.lastDoneTransitionId = this.transitionId;
		}
		this.transitionId = this.transitionId + 1;
		if(this.transitionBegin) {
			this.transitionBegin(this.transitionId);
		}
		return this.transitionId;
	}
	
	private isTransitionCancelled(transitionIdSnapshot: number): boolean {
		return transitionIdSnapshot !== this.transitionId;
	}
	
	private endCurrentTransition() {
		if(this.transitionEnd) {
			this.transitionEnd(this.transitionId);
		}
		this.lastDoneTransitionId = this.transitionId;
	}
	
	private cancelCurrentTransition(transitionIdSnapshot: number) {
		if(this.lastDoneTransitionId < transitionIdSnapshot) {
			if(this.transitionCancel) {
				this.transitionCancel(transitionIdSnapshot);
			}
			this.lastDoneTransitionId = transitionIdSnapshot;
		}
	}
	
	private buildConfigStateUrl(configs: RouterConfigInternal[], urlParams: RouterUrlParams, queryParams: RouterQueryParams): string {
		for(var n = configs.length - 1; n >= 0; n--) {
			var config = configs[n];
			if(config.pathBuildFunc) {
				var url = config.pathBuildFunc(urlParams);
				var queryStr = queryString.stringify(queryParams);
				if(queryStr) {
					url = url + '?' + queryStr;
				}
				return url;
			}
		}
		return '/';
	}

	private updateUrl = () => {
		if(!this.isRunning()) {
			return;
		}
		var url = this.history.getUrl();
		var configPath = this.history.getConfigPath();
		var transitionIdSnapshot = this.beginNewTransition();
		if(!url) {
			if(this.urlMissingRouteCallback) {
				this.urlMissingRouteCallback()
			}
			return;
		}
		if((configPath === this.currentState.configPath) && (url === this.currentState.url)) {
			return;
		}
		var urlParts = urllite(url);
		var queryParams: RouterUrlParams = urlParts.search ? queryString.parse(urlParts.search) : {};
		var historyTrackId = this.history.getHistoryTrackId();
		if(configPath) {
			var configPathParts: string[] = configPath.split('.');
			this.findRouterConfigByName(configPathParts, 0, this.rootConfig, []).then((configs) => {
				if(this.isTransitionCancelled(transitionIdSnapshot)) {
					return;
				}
				this.updateStateFromNamedConfig(configPath, url, queryParams, historyTrackId, configs);
				this.endCurrentTransition();
			}).then(undefined, (error) => {
				this.fireRouteNotFoundCallback(error, configPath, url, null, queryParams);
				this.cancelCurrentTransition(transitionIdSnapshot);
			});
		} else {
			var errorPath: string = null;
			this.findRoutedConfigByUrl(this.rootConfig, [], urlParts.pathname, []).then((configMatch) => {
				if(this.isTransitionCancelled(transitionIdSnapshot)) {
					return;
				}
				if(!configMatch) {
					throw new RouterNotFoundException('Unable to find state for URL: ' + url, null);
				} else if(configMatch.prefixMatch) {
					errorPath = this.findErrorPathInMatch(configMatch);
					if(errorPath) {
						return this.findRouterConfigByName(errorPath.split('.'), 0, this.rootConfig, []);
					} else {
						throw new RouterNotFoundException('Unable to find state for URL: ' + url, configMatch.configMatches);
					}
				}
				var newConfig: RouterConfigInternal = configMatch.configMatches[configMatch.configMatches.length - 1];
				if(this.pendingReload && newConfig.url && newConfig.reloadable) {
					this.history.reloadAtUrl(url);
				}
				var urlParams: RouterUrlParams = this.buildUrlParams(newConfig.pathParams, configMatch.pathMatches);
				this.updateState(configMatch.configPath, url, urlParams, queryParams, historyTrackId, configMatch.configMatches);
				if(this.routeFoundCallback) {
					this.routeFoundCallback(this.currentState);
				}
				this.endCurrentTransition();
			}).then((configs) => {
				if(!configs) {
					return;
				}
				if(this.isTransitionCancelled(transitionIdSnapshot)) {
					return;
				}
				this.updateStateFromNamedConfig(errorPath, url, queryParams, historyTrackId, configs);
				this.endCurrentTransition();
			}).then(undefined, (error) => {
				this.fireRouteNotFoundCallback(error, null, url, null, queryParams);
				this.cancelCurrentTransition(transitionIdSnapshot);
			});
		}
	};

	private updateStateFromNamedConfig(configPath: string, url: string, queryParams: RouterQueryParams, historyTrackId: string, configs: RouterConfig[]) {
		var newConfig: RouterConfigInternal = configs[configs.length - 1];
		if(newConfig.unrouted) {
			throw new RouterNotFoundException('Unable to change to unrouted path: ' + configPath, configs);
		}
		if(this.pendingReload && newConfig.url && newConfig.reloadable) {
			this.history.reloadAtUrl(url);
		}
		var urlParams: RouterUrlParams = this.findAndBuildUrlParams(url, configs);
		this.updateState(configPath, url, urlParams, queryParams, historyTrackId, configs);
		if(this.routeFoundCallback) {
			this.routeFoundCallback(this.currentState);
		}
	}
	
	private findAndBuildUrlParams(url: string, configs: RouterConfigInternal[]): RouterUrlParams {
		if(!url || !configs) {
			return {};
		}
		for(var n = configs.length - 1; n >= 0; n--) {
			var config: RouterConfigInternal = configs[n];
			if(config.pathRegExp) {
				var pathMatches = config.pathRegExp.exec(url);
				if(pathMatches) {
					return this.buildUrlParams(config.pathParams, pathMatches);
				}
			}
			if(config.pathPrefixRegExp) {
				var pathMatches = config.pathPrefixRegExp.exec(url);
				if(pathMatches) {
					return this.buildUrlParams(config.pathPrefixParams, pathMatches);
				}
			}
		}
		return {};
	}
	
	private buildUrlParams(pathParams: PathToRegExpKey[], pathMatches: RegExpExecArray): RouterUrlParams {
		var urlParams: RouterUrlParams = {};
		for(var n = 0; (n < pathParams.length) && (n + 1 < pathMatches.length); n++) {
			urlParams[pathParams[n].name] = pathMatches[n + 1];
		}
		return urlParams;
	}
	
	private findErrorPathInMatch(configMatch: RouterConfigMatch): string {
		if(!configMatch || !configMatch.configMatches) {
			return null;
		}
		for(var n = configMatch.configMatches.length - 1; n >= 0; n--) {
			var config = configMatch.configMatches[n];
			if(config.errorPath) {
				return config.errorPath;
			}
		}
		return null;
	}
	
	private findRouterConfigByName(configPathParts: string[], startRouteNameIndex: number, parentConfig: RouterConfigInternal, configs: RouterConfig[]): Thenable<RouterConfig[]> {
		return new Promise<RouterConfig[]>((resolve, reject) => {
			var currentConfig: RouterConfigInternal = null;
			for(var n = startRouteNameIndex; n < configPathParts.length; n++) {
				var configPathPart = configPathParts[n];
				currentConfig = parentConfig.configs[configPathPart];
				if(currentConfig) {
					configs = configs.concat([currentConfig]);
					parentConfig = currentConfig;
				} else {
					if(parentConfig.routeExtensionCallback && !parentConfig.routeExtended) {
						this.extendRouterConfig(configPathParts, parentConfig).then((config) => {
							resolve(this.findRouterConfigByName(configPathParts, n, config, configs));
						}).then(undefined, (error) => {
							this.logError(error);
							reject(error);
						});
					} else {
						reject(new RouterNotFoundException('Unable to find router config for path: ' + configPathParts.join('.'), configs));
					}
					return;
				}
			}
			resolve(configs);
		});
	}

	private findRoutedConfigByUrl(config: RouterConfigInternal, configPath: string[], url: string, configs: RouterConfig[]): Thenable<RouterConfigMatch> {
		return new Promise((resolve, reject) => {
			var pathPrefixRegExp = config.pathPrefixRegExp;
			var subConfigs: RouterConfig[] = null;
			if(pathPrefixRegExp) {
				var pathPrefixParams = pathPrefixRegExp.exec(url);
				if(pathPrefixParams) {
					if(config.routeExtensionCallback && !config.routeExtended) {
						this.extendRouterConfig(configPath, config).then((extConfig) => {
							resolve(this.findRoutedConfigByUrl(extConfig, configPath, url, configs));
						});
						return;
					}
					subConfigs = configs.concat([config]);
					var subCalls: Thenable<RouterConfigMatch>[] = [];
					for(var key in config.configs) {
						var subConfig = config.configs[key];
						subCalls.push(this.findRoutedConfigByUrl(subConfig, configPath.concat([key]), url, subConfigs));
					}
					if(subCalls.length > 0) {
						Promise.all(subCalls).then((subMatches: RouterConfigMatch[]) => {
							var bestSubMatch: RouterConfigMatch = null;
							for(var n = 0; n < subMatches.length; n++) {
								var subMatch = subMatches[n];
								if(subMatch) {
									if(!bestSubMatch || (!subMatch.prefixMatch && bestSubMatch.prefixMatch) || (subMatch.configMatches && (!bestSubMatch.configMatches || (subMatch.configMatches.length > bestSubMatch.configMatches.length)))) {
										bestSubMatch = subMatch;
									}
								}
							}
							if(bestSubMatch) {
								resolve(bestSubMatch);
							}
							resolve(this.matchRoutedConfigToUrl(config, configPath, url, configs, pathPrefixParams));
						});
						return;
					}
					resolve(this.matchRoutedConfigToUrl(config, configPath, url, configs, pathPrefixParams));
					return;
				}
			}
			resolve(this.matchRoutedConfigToUrl(config, configPath, url, configs, null));
		});
	}

	private matchRoutedConfigToUrl(config: RouterConfigInternal, configPath: string[], url: string, configs: RouterConfig[], pathPrefixParams: RegExpExecArray): RouterConfigMatch {
		if(config.pathRegExp) {
			var pathMatches = config.pathRegExp.exec(url);
			if(pathMatches) {
				return {
					configPath: configPath.join('.'),
					pathMatches: pathMatches,
					configMatches: configs.concat([config]),
					prefixMatch: false
				};
			}
		}
		if(pathPrefixParams) {
			return {
				configPath: configPath.join('.'),
				pathMatches: pathPrefixParams,
				configMatches: configs.concat([config]),
				prefixMatch: true
			};
		}
		return null;
	}
	
	private extendRouterConfig(configPath: string[], config: RouterConfigInternal): Thenable<RouterConfig> {
		if(!config.routeExtensionPromise) {
			config.routeExtensionPromise = new Promise((resolve, reject) => {
				var routeExtension = config.routeExtensionCallback();
				routeExtension.then((configMap) => {
					config.routeExtended = true;
					config.routeExtensionPromise = null;
					if(configMap) {
						config.configs = extend(true, config.configs || {}, configMap);
						this.buildRouterConfigs();
						resolve(config);
					} else {
						reject(new RouterException('Router extension in "' + configPath.join('.') + '" did not return a config map'));
					}
				}).then(undefined, (error) => {
					this.logError(error);
					config.routeExtensionPromise = null;
					reject(error);
				});
			});
		}
		return config.routeExtensionPromise;
	}
	
	private buildRouterConfigs() {
		this.buildRouterMappingForConfig(this.rootConfig, '');
	}
	
	private buildRouterMappingForConfig(config: RouterConfigInternal, urlPrefix: string): boolean {
		var url = this.buildConfigUrl(urlPrefix, config.url);
		config.configs = config.configs || {};
		var hasRoutedSubConfig = config.routeExtensionCallback && !config.routeExtended;
		for(var key in config.configs) {
			var subConfig = config.configs[key];
			if(this.buildRouterMappingForConfig(subConfig, url)) {
				hasRoutedSubConfig = true;
			}
		}
		var isRoutedConfig = this.buildRoutedConfigUrlMapping(config, url);
		this.buildRouterConfigUrlPrefix(config, url, hasRoutedSubConfig);
		
		return isRoutedConfig || hasRoutedSubConfig;
	}
	
	private buildConfigUrl(urlPrefix: string, configUrl: string): string {
		if(!configUrl) {
			return urlPrefix;
		}
		if(configUrl.charAt(0) === '^') {
			if((configUrl.length < 2) || (configUrl.charAt(1) !== '/')) {
				return '/' + configUrl.substring(1);
			} else {
				return configUrl.substring(1);
			}
		} else if(urlPrefix === '/') {
			if(configUrl.charAt(0) !== '/') {
				return '/' + configUrl;
			} else {
				return configUrl;
			}
		} else {
			if(configUrl.charAt(0) !== '/') {
				return urlPrefix + '/' + configUrl;
			} else {
				return urlPrefix + configUrl;
			}
		}
	}
	
	private buildRoutedConfigUrlMapping(config: RouterConfigInternal, url: string): boolean {
		if(config.url && !config.unrouted) {
			var pathTokens = pathToRegexp.parse(url);
			config.pathRegExp = pathToRegexp.tokensToRegExp(pathTokens, {});
			config.pathBuildFunc = pathToRegexp.tokensToFunction(pathTokens);
			config.pathParams = [];
			for(var n = 0; n < pathTokens.length; n++) {
				if(typeof pathTokens[n] !== 'string') {
					config.pathParams.push(<PathToRegExpKey>pathTokens[n]);
				}
			}
			return true;
		} else {
			delete config.pathParams;
			delete config.pathRegExp;
			delete config.pathBuildFunc;
			return false;
		}
	}
	
	private buildRouterConfigUrlPrefix(config: RouterConfigInternal, url: string, hasRoutedSubConfig: boolean) {
		if(hasRoutedSubConfig) {
			var pathParams: PathToRegExpKey[] = [];
			if(url === '/') {
				url = url + '*';
			} else {
				url = url + '/*';
			}
			config.pathPrefixRegExp = pathToRegexp(url, pathParams);
			config.pathPrefixParams = pathParams;
		} else {
			delete config.pathPrefixRegExp;
			delete config.pathPrefixParams;
		}
	}

	private fireRouteNotFoundCallback(error: any, configPath: string, url: string, urlParams: RouterUrlParams, queryParams: RouterQueryParams) {
		this.logError(error);
		if(this.routeNotFoundCallback) {
			var partialState: RouterState = null;
			var matchedConfigs: RouterConfig[] = null;
			if(error instanceof RouterNotFoundException) {
				matchedConfigs = (<RouterNotFoundException>error).matched;
			}
			this.routeNotFoundCallback(configPath, url, matchedConfigs, error);
		}
	}
	
	private buildPartialState(configPath: string, url: string, urlParams: RouterUrlParams, queryParams: RouterQueryParams, newConfigs: RouterConfig[]): RouterState {
		var state: RouterState = {
			configPath: configPath,
			url: url,
			urlParams: urlParams,
			queryParams: queryParams,
			historyTrackId: null,
			data: {}
		};
		for(var n = 0; n < newConfigs.length; n++) {
			state.data = extend(true, state.data, newConfigs[n].data || {});
		}
		return state;
	}

	private updateState(configPath: string, url: string, urlParams: RouterUrlParams, queryParams: RouterQueryParams, historyTrackId: string, newConfigs: RouterConfig[]) {
		var state: RouterState = {
			configPath: configPath,
			url: url,
			urlParams: urlParams,
			queryParams: queryParams,
			historyTrackId: historyTrackId,
			data: {}
		}
		var newStateDatas: RouterStateData[] = [];
		var prefixLength = this.findCommonStatePrefix(newConfigs);
		for(var n = 0; n < prefixLength; n++) {
			var newConfig = newConfigs[n];
			if(newConfig.refreshCallback) {
				newStateDatas.push(newConfig.refreshCallback(state, state.data, this.currentStateDatas[n]));
			} else {
				newStateDatas.push(this.currentStateDatas[n]);
			}
			state.data = extend(true, state.data, newStateDatas[n]);
		}
		for(var n = prefixLength; n < newConfigs.length; n++) {
			var newConfig = newConfigs[n];
			if(newConfig.setupCallback) {
				newStateDatas.push(newConfig.setupCallback(state, state.data, newConfig.data));
			} else {
				newStateDatas.push(newConfig.data || {});
			}
			state.data = extend(true, state.data, newStateDatas[n]);
		}
		for(var n = this.currentConfigs.length - 1; n >= prefixLength; n--) {
			var oldConfig = this.currentConfigs[n];
			if(oldConfig.teardownCallback) {
				oldConfig.teardownCallback(this.currentStateDatas[n]);
			}
		}
		this.currentState = state;
		this.currentStateDatas = newStateDatas;
		this.currentConfigs = newConfigs;
	}
	
	private findCommonStatePrefix(newConfigs: RouterConfig[]): number {
		var maxLength = Math.max(newConfigs.length, this.currentConfigs.length);
		var length = 0;
		while(length < maxLength) {
			if(newConfigs[length] !== this.currentConfigs[length]) {
				return length;
			}
			length++;
		}
		return length;
	}
	
	private logError(error: any) {
		if(console && console.error) {
			console.error(error);
		}
	}
}
