// Copyright (c) 2016 Göran Gustafsson. All rights reserved.  
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

import * as extend from 'extend';
import * as pathToRegexp from 'path-to-regexp';
import * as queryString from 'query-string';
import urllite = require('urllite');

import {
	RouterStateData, RouterUrlParams, RouterQueryParams, RouterState, RouterConfig,
	RouteFoundCallback, RouteNotFoundCallback, UrlMissingRouteCallback,
	TransitionBeginCallback, TransitionCancelCallback, TransitionEndCallback
} from './router-types';
import { RouterHistory } from './router-history';
import { RouterException } from './router-exception';
import { RouterNotFoundException } from './router-not-found-exception';

interface RouterConfigInternal extends RouterConfig<{}, {}, {}> {
	routeExtensionPromise?: Promise<RouterConfig<{}, {}, {}>>;
	routeExtended?: boolean;
	pathPrefixRegExp?: RegExp;
	pathPrefixParams?: PathToRegExpKey[];
	pathRegExp?: RegExp;
	pathBuildFunc?: (params: any) => string;
	pathParams?: PathToRegExpKey[];
	rootSubUrl?: boolean;
}

interface RouterConfigMatch {
	configPath: string;
	pathMatches: RegExpExecArray;
	configMatches: RouterConfig<{}, {}, {}>[];
	prefixMatch: boolean;
}

interface RouterAccumulatedPropMap {
	[name: string]: any[];
}

type RouterPossibleConfigMatch = RouterConfigMatch | undefined;
type RouterPossibleConfigs = RouterConfig<{}, {}, {}>[] | undefined;

export class Router {

	private history: RouterHistory;
	private routeFoundCallback: RouteFoundCallback<any, any, any>;
	private routeNotFoundCallback: RouteNotFoundCallback<any, any, any> | undefined;
	private urlMissingRouteCallback: UrlMissingRouteCallback | undefined;
	private transitionBegin: TransitionBeginCallback | undefined;
	private transitionCancel: TransitionCancelCallback | undefined;
	private transitionEnd: TransitionEndCallback | undefined;
	private running: boolean;

	private pendingReload: boolean;

	private currentState: RouterState<any, any, any>;
	private currentStateDatas: RouterStateData[];
	private currentConfigs: RouterConfig<{}, {}, {}>[];

	private transitionId: number;
	private lastDoneTransitionId: number;

	private accumulatedPropNames: string[] = [];
	private nonInheritedPropNames: string[] = [];
	protected rootConfig: RouterConfig<{}, {}, {}>;

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
			historyTrackId: undefined,
			data: {}
		};
		this.currentStateDatas = [];
		this.currentConfigs = [];
		this.transitionId = 0;
		this.lastDoneTransitionId = 0;
		this.buildRouterConfigUrlPrefix(this.rootConfig, '', true, false);
	}

	public getCurrentState<UP, QP, SD>(): RouterState<UP, QP, SD> {
		return this.currentState;
	}

	public setAccumulatedStateDataPropNames(propNames: string[]) {
		this.accumulatedPropNames = propNames;
	}

	public setNonInheritedStateDataPropNames(propNames: string[]) {
		this.nonInheritedPropNames = propNames;
	}

	public isRunning(): boolean {
		return this.running;
	}

	public requestReload(): void {
		this.pendingReload = true;
	}

	public addConfig<UP, QP, SD>(configPath: string, config: RouterConfig<UP, QP, SD>): void {
		const configPathParts: string[] = configPath.split('.');
		let parentConfig: RouterConfig<{}, {}, {}> = this.rootConfig;
		for(let n = 0; n < configPathParts.length; n++) {
			const configPathPart = configPathParts[n];
			const configs = parentConfig.configs || {};
			let currentConfig = configs[configPathPart];
			if(!currentConfig) {
				currentConfig = {
					configs: {}
				};
				configs[configPathPart] = currentConfig;
			}
			if(n === configPathParts.length - 1) {
				configs[configPathPart] = extend(true, currentConfig, config);
				break;
			}
			parentConfig = currentConfig;
		}
		if(this.isRunning()) {
			this.buildRouterConfigs();
		}
	}

	public start<UP, QP, SD>(
				history: RouterHistory,
				routeFoundCallback: RouteFoundCallback<UP, QP, SD>,
				routeNotFoundCallback?: RouteNotFoundCallback<UP, QP, SD>,
				urlMissingRouteCallback?: UrlMissingRouteCallback,
				transitionBegin?: TransitionBeginCallback,
				transitionCancel?: TransitionCancelCallback,
				transitionEnd?: TransitionEndCallback): void {
		if(this.isRunning()) {
			throw new RouterException('Router already running');
		}
		this.history = history;
		this.routeFoundCallback = routeFoundCallback;
		this.routeNotFoundCallback = routeNotFoundCallback;
		this.urlMissingRouteCallback = urlMissingRouteCallback;
		this.transitionBegin = transitionBegin;
		this.transitionCancel = transitionCancel;
		this.transitionEnd = transitionEnd;
		this.history.startHistoryUpdates(this.updateFromHistory);
		this.buildRouterConfigs();
		this.running = true;
		this.history.init();
	}

	public stop(): void {
		if(this.isRunning()) {
			this.history.stopHistoryUpdates();
		}
		this.running = false;
	}

	public navigateTo<UP, QP, SD>(
				configPath: string,
				urlParams?: RouterUrlParams & UP,
				queryParams?: RouterQueryParams & QP,
				extraStateData?: RouterStateData & SD): Promise<RouterState<UP, QP, SD>> {
		if(!this.isRunning()) {
			throw new RouterException('Router is not running');
		}
		const transitionIdSnapshot = this.beginNewTransition();
		return new Promise<RouterState<UP, QP, SD>>((resolve, reject) => {
			const configPathParts: string[] = configPath.split('.');
			this.findRouterConfigByName(configPathParts, 0, this.rootConfig, []).then((configs) => {
				if(this.isTransitionCancelled(transitionIdSnapshot)) {
					return;
				}
				const newConfig: RouterConfigInternal = configs[configs.length - 1];
				if(newConfig.unrouted) {
					throw new RouterNotFoundException('Unable to navigate to unrouted path: ' + configPath, configs);
				}
				const url = this.buildConfigStateUrl(configs, urlParams || {}, queryParams || {});
				if(this.pendingReload && newConfig.url && newConfig.reloadable) {
					this.history.reloadAtUrl(url);
				}
				this.history.navigateTo(configPath, url);
				const historyTrackId = this.history.getHistoryTrackId();
				this.updateState(configPath, url, urlParams || {}, queryParams || {}, historyTrackId, configs, extraStateData);
				if(this.routeFoundCallback) {
					this.routeFoundCallback(this.currentState);
				}
				this.endCurrentTransition();
				resolve(this.currentState);
			})['catch']((error: Error) => {
				this.fireRouteNotFoundCallback(error, configPath, undefined, urlParams || {}, queryParams || {});
				if(this.transitionCancel) {
					this.transitionCancel(transitionIdSnapshot);
				}
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

	private endCurrentTransition(): void {
		if(this.transitionEnd) {
			this.transitionEnd(this.transitionId);
		}
		this.lastDoneTransitionId = this.transitionId;
	}

	private cancelCurrentTransition(transitionIdSnapshot: number): void {
		if(this.lastDoneTransitionId < transitionIdSnapshot) {
			if(this.transitionCancel) {
				this.transitionCancel(transitionIdSnapshot);
			}
			this.lastDoneTransitionId = transitionIdSnapshot;
		}
	}

	private buildConfigStateUrl(configs: RouterConfigInternal[], urlParams: RouterUrlParams, queryParams: RouterQueryParams): string {
		for(let n = configs.length - 1; n >= 0; n--) {
			const config = configs[n];
			if(config.pathBuildFunc) {
				let url = config.pathBuildFunc(urlParams);
				let params: { [key: string]: (string | number | boolean) | (string | number | boolean)[] } = {};
				for(let key in queryParams) {
					if(!queryParams.hasOwnProperty(key)) {
						continue;
					}
					const value = queryParams[key];
					if(value) {
						params[key] = value;
					}
				}
				const queryStr = queryString.stringify(params);
				if(queryStr) {
					url = url + '?' + queryStr;
				}
				return url;
			}
		}
		return '/';
	}

	protected updateFromHistory = (): void => {
		if(!this.isRunning()) {
			return;
		}
		const url = this.history.getUrl();
		const configPath = this.history.getConfigPath();
		const transitionIdSnapshot = this.beginNewTransition();
		if(!url) {
			if(this.urlMissingRouteCallback) {
				this.urlMissingRouteCallback();
			}
			return;
		}
		const urlParts = urllite(url);
		const queryParams: RouterQueryParams = urlParts.search ? queryString.parse(urlParts.search) : {};
		const historyTrackId = this.history.getHistoryTrackId();
		if(configPath) {
			const configPathParts: string[] = configPath.split('.');
			this.findRouterConfigByName(configPathParts, 0, this.rootConfig, []).then((configs) => {
				if(this.isTransitionCancelled(transitionIdSnapshot)) {
					return;
				}
				this.updateStateFromNamedConfig(configPath, url, urlParts.pathname, queryParams, historyTrackId, configs);
				this.endCurrentTransition();
			})['catch']((error: Error) => {
				this.fireRouteNotFoundCallback(error, configPath, url, {}, queryParams);
				this.cancelCurrentTransition(transitionIdSnapshot);
			});
		} else {
			let errorPath: string | undefined = undefined;
			this.findRoutedConfigByUrl(this.rootConfig, [], urlParts.pathname, []).then<RouterPossibleConfigs>((configMatch: RouterPossibleConfigMatch) => {
				if(this.isTransitionCancelled(transitionIdSnapshot)) {
					return undefined;
				}
				if(!configMatch) {
					throw new RouterNotFoundException('Unable to find state for URL: ' + url, undefined);
				} else if(configMatch.prefixMatch) {
					errorPath = this.findErrorPathInMatch(configMatch);
					if(errorPath) {
						return this.findRouterConfigByName(errorPath.split('.'), 0, this.rootConfig, []);
					} else {
						throw new RouterNotFoundException('Unable to find state for URL: ' + url, configMatch.configMatches);
					}
				}
				const newConfig: RouterConfigInternal = configMatch.configMatches[configMatch.configMatches.length - 1];
				if(this.pendingReload && newConfig.url && newConfig.reloadable) {
					this.history.reloadAtUrl(url);
				}
				const urlParams: RouterUrlParams = this.buildUrlParams(newConfig.pathParams, configMatch.pathMatches);
				this.updateState(configMatch.configPath, url, urlParams, queryParams, historyTrackId, configMatch.configMatches, undefined);
				if(this.routeFoundCallback) {
					this.routeFoundCallback(this.currentState);
				}
				this.endCurrentTransition();
				return undefined;
			}).then((configs: RouterPossibleConfigs) => {
				if(!configs) {
					return;
				}
				if(this.isTransitionCancelled(transitionIdSnapshot)) {
					return;
				}
				this.updateStateFromNamedConfig(errorPath || '', url, urlParts.pathname, queryParams, historyTrackId, configs);
				this.endCurrentTransition();
			})['catch']((error: Error) => {
				this.fireRouteNotFoundCallback(error, undefined, url, {}, queryParams);
				this.cancelCurrentTransition(transitionIdSnapshot);
			});
		}
	};

	private updateStateFromNamedConfig(
				configPath: string,
				url: string,
				urlPath: string,
				queryParams: RouterQueryParams,
				historyTrackId: string | undefined,
				configs: RouterConfig<{}, {}, {}>[]) {
		const newConfig: RouterConfigInternal = configs[configs.length - 1];
		if(newConfig.unrouted) {
			throw new RouterNotFoundException('Unable to change to unrouted path: ' + configPath, configs);
		}
		if(this.pendingReload && newConfig.url && newConfig.reloadable) {
			this.history.reloadAtUrl(url);
		}
		const urlParams: RouterUrlParams = this.findAndBuildUrlParams(urlPath, configs);
		this.updateState(configPath, url, urlParams, queryParams, historyTrackId, configs, undefined);
		if(this.routeFoundCallback) {
			this.routeFoundCallback(this.currentState);
		}
	}

	private findAndBuildUrlParams(url: string, configs: RouterConfigInternal[]): RouterUrlParams {
		if(!url || !configs) {
			return {};
		}
		for(let n = configs.length - 1; n >= 0; n--) {
			const config: RouterConfigInternal = configs[n];
			if(config.pathRegExp) {
				const pathMatches = config.pathRegExp.exec(url);
				if(pathMatches) {
					return this.buildUrlParams(config.pathParams, pathMatches);
				}
			}
			if(config.pathPrefixRegExp) {
				const pathMatches = config.pathPrefixRegExp.exec(url);
				if(pathMatches) {
					return this.buildUrlParams(config.pathPrefixParams, pathMatches);
				}
			}
		}
		return {};
	}

	private buildUrlParams(pathParams: PathToRegExpKey[] | undefined, pathMatches: RegExpExecArray): RouterUrlParams {
		const urlParams: RouterUrlParams = {};
		if(pathParams) {
			for(let n = 0; (n < pathParams.length) && (n + 1 < pathMatches.length); n++) {
				urlParams[pathParams[n].name] = pathMatches[n + 1];
			}
		}
		return urlParams;
	}

	private findErrorPathInMatch(configMatch: RouterConfigMatch): string | undefined {
		if(!configMatch || !configMatch.configMatches) {
			return undefined;
		}
		for(let n = configMatch.configMatches.length - 1; n >= 0; n--) {
			const config = configMatch.configMatches[n];
			if(config.errorPath) {
				return config.errorPath;
			}
		}
		return undefined;
	}

	private findRouterConfigByName(
				configPathParts: string[],
				startRouteNameIndex: number,
				parentConfig: RouterConfigInternal,
				configs: RouterConfig<{}, {}, {}>[]): Promise<RouterConfig<{}, {}, {}>[]> {
		return new Promise<RouterConfig<{}, {}, {}>[]>((resolve, reject) => {
			let currentConfig: RouterConfigInternal | undefined = undefined;
			for(let n = startRouteNameIndex; n < configPathParts.length; n++) {
				const configPathPart = configPathParts[n];
				const parentConfigs = parentConfig.configs || {};
				currentConfig = parentConfigs[configPathPart];
				if(currentConfig) {
					configs = configs.concat([currentConfig]);
					parentConfig = currentConfig;
				} else {
					if(parentConfig.routeExtensionCallback && !parentConfig.routeExtended) {
						this.extendRouterConfig(configPathParts, parentConfig).then((config) => {
							resolve(this.findRouterConfigByName(configPathParts, n, config, configs));
						})['catch']((error: Error) => {
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

	private findRoutedConfigByUrl(
				config: RouterConfigInternal,
				configPath: string[],
				url: string,
				configs: RouterConfig<{}, {}, {}>[]): Promise<RouterPossibleConfigMatch> {
		return new Promise<RouterPossibleConfigMatch>((resolve, reject) => {
			const pathPrefixRegExp = config.pathPrefixRegExp;
			let subConfigs: RouterConfig<{}, {}, {}>[] | undefined = undefined;
			if(pathPrefixRegExp || config.rootSubUrl) {
				let pathPrefixParams: RegExpExecArray | null = null;
				if(pathPrefixRegExp) {
					pathPrefixParams = pathPrefixRegExp.exec(url);
				}
				if(pathPrefixParams || config.rootSubUrl) {
					if(config.routeExtensionCallback && !config.routeExtended) {
						this.extendRouterConfig(configPath, config).then((extConfig) => {
							resolve(this.findRoutedConfigByUrl(extConfig, configPath, url, configs));
						})['catch']((error: Error) => {
							reject(error);
						});
						return;
					}
					subConfigs = configs.concat([config]);
					let subCalls: PromiseLike<RouterPossibleConfigMatch>[] = [];
					const configConfigs = config.configs || {};
					for(let key in configConfigs) {
						if(!configConfigs.hasOwnProperty(key)) {
							continue;
						}
						const subConfig = configConfigs[key];
						subCalls.push(this.findRoutedConfigByUrl(subConfig, configPath.concat([key]), url, subConfigs));
					}
					if(subCalls.length > 0) {
						Promise.all<RouterPossibleConfigMatch>(subCalls).then((subMatches: RouterPossibleConfigMatch[]) => {
							let bestMatch: RouterPossibleConfigMatch = undefined;
							for(let n = 0; n < subMatches.length; n++) {
								const subMatch = subMatches[n];
								if(subMatch) {
									if(!bestMatch
											|| (!subMatch.prefixMatch
												&& bestMatch.prefixMatch)
											|| (subMatch.configMatches
												&& (!bestMatch.configMatches || (subMatch.configMatches.length > bestMatch.configMatches.length)))) {
										bestMatch = subMatch;
									}
								}
							}
							if(bestMatch && bestMatch.prefixMatch) {
								const match = this.matchRoutedConfigToUrl(config, configPath, url, configs, pathPrefixParams);
								if(match && !match.prefixMatch) {
									bestMatch = match;
								}
							}
							if(bestMatch) {
								resolve(bestMatch);
							} else {
								resolve(this.matchRoutedConfigToUrl(config, configPath, url, configs, pathPrefixParams));
							}
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

	private matchRoutedConfigToUrl(
				config: RouterConfigInternal,
				configPath: string[],
				url: string,
				configs: RouterConfig<{}, {}, {}>[],
				pathPrefixParams: RegExpExecArray | null): RouterPossibleConfigMatch {
		if(config.pathRegExp) {
			const pathMatches = config.pathRegExp.exec(url);
			if(pathMatches) {
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
		if(pathPrefixParams) {
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
	}

	private extendRouterConfig(configPath: string[], config: RouterConfigInternal): Promise<RouterConfig<{}, {}, {}>> {
		if(!config.routeExtensionPromise) {
			config.routeExtensionPromise = new Promise((resolve, reject) => {
				if(!config.routeExtensionCallback) {
					reject(new Error(''));
				} else {
					const routeExtension = config.routeExtensionCallback(configPath.join('.'), config);
					routeExtension.then((configMap) => {
						config.routeExtended = true;
						config.routeExtensionPromise = undefined;
						if(configMap) {
							config.configs = extend(true, config.configs || {}, configMap);
							this.buildRouterConfigs();
							resolve(config);
						} else {
							reject(new RouterException('Router extension in "' + configPath.join('.') + '" did not return a config map'));
						}
					})['catch']((error: Error) => {
						config.routeExtensionPromise = undefined;
						reject(error);
					});
				}
			});
		}
		return config.routeExtensionPromise;
	}

	private buildRouterConfigs() {
		this.buildRouterMappingForConfig(this.rootConfig, '');
	}

	private buildRouterMappingForConfig(config: RouterConfigInternal, urlPrefix: string): boolean[] {
		const url = this.buildConfigUrl(urlPrefix, config.url);
		config.configs = config.configs || {};
		let hasRootConfigUrl = false;
		let hasRoutedSubConfig = !!config.routeExtensionCallback && !config.routeExtended;
		for(let key in config.configs) {
			if(!config.configs.hasOwnProperty(key)) {
				continue;
			}
			const subConfig = config.configs[key];
			const subFlags = this.buildRouterMappingForConfig(subConfig, url);
			if(subFlags[0]) {
				hasRoutedSubConfig = true;
			}
			if(subFlags[1]) {
				hasRootConfigUrl = true;
			}
		}
		const isRoutedConfig = this.buildRoutedConfigUrlMapping(config, url);
		this.buildRouterConfigUrlPrefix(config, url, hasRoutedSubConfig, hasRootConfigUrl);

		return [isRoutedConfig || hasRoutedSubConfig, hasRootConfigUrl || this.hasRootConfigUrl(config.url)];
	}

	private buildConfigUrl(urlPrefix: string, configUrl: string | undefined): string {
		if(!configUrl) {
			return urlPrefix;
		}
		if(this.hasRootConfigUrl(configUrl)) {
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

	private hasRootConfigUrl(configUrl: string | undefined) {
		return !!configUrl && (configUrl.charAt(0) === '^');
	}

	private buildRoutedConfigUrlMapping(config: RouterConfigInternal, url: string): boolean {
		if(config.url && !config.unrouted) {
			const pathTokens = pathToRegexp.parse(url);
			config.pathRegExp = pathToRegexp.tokensToRegExp(pathTokens, {});
			config.pathBuildFunc = pathToRegexp.tokensToFunction(pathTokens);
			config.pathParams = [];
			for(let n = 0; n < pathTokens.length; n++) {
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

	private buildRouterConfigUrlPrefix(config: RouterConfigInternal, url: string, hasRoutedSubConfig: boolean, hasRootConfigUrl: boolean) {
		if(hasRoutedSubConfig) {
			let pathParams: PathToRegExpKey[] = [];
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
		config.rootSubUrl = hasRootConfigUrl;
	}

	private fireRouteNotFoundCallback(
				error: any,
				configPath: string | undefined,
				url: string | undefined,
				urlParams: RouterUrlParams,
				queryParams: RouterQueryParams) {
		if(this.routeNotFoundCallback) {
			let matchedConfigs: RouterConfig<{}, {}, {}>[] | undefined = undefined;
			if(error instanceof RouterNotFoundException) {
				matchedConfigs = (<RouterNotFoundException<any, any, any>>error).matched;
			}
			this.routeNotFoundCallback(configPath, url, matchedConfigs, error);
		} else {
			this.logError(error);
		}
	}

	private updateState(
				configPath: string,
				url: string,
				urlParams: RouterUrlParams,
				queryParams: RouterQueryParams,
				historyTrackId: string | undefined,
				newConfigs: RouterConfig<{}, {}, {}>[],
				extraStateData: RouterStateData | undefined) {
		const state: RouterState<any, any, any> = {
			configPath: configPath,
			url: url,
			urlParams: urlParams,
			queryParams: queryParams,
			historyTrackId: historyTrackId,
			data: {}
		};
		let newStateDatas: RouterStateData[] = [];
		let accumulatedDataProps: RouterAccumulatedPropMap = this.prepareAccumulatedPropNames();
		const prefixLength = this.findCommonStatePrefix(newConfigs);
		let lastStateData: RouterStateData | undefined = undefined;
		for(let n = 0; n < prefixLength; n++) {
			const newConfig = newConfigs[n];
			if(newConfig.refreshCallback) {
				lastStateData = newConfig.refreshCallback(state, state.data, this.currentStateDatas[n]);
			} else {
				lastStateData = this.currentStateDatas[n];
			}
			newStateDatas.push(lastStateData);
			this.accumulateStateDataProps(accumulatedDataProps, newStateDatas[n]);
			state.data = extend(true, state.data, newStateDatas[n]);
		}
		for(let n = prefixLength; n < newConfigs.length; n++) {
			const newConfig = newConfigs[n];
			if(newConfig.setupCallback) {
				lastStateData = newConfig.setupCallback(state, state.data, extend({}, newConfig.data || {}));
			} else {
				lastStateData = newConfig.data || {};
			}
			newStateDatas.push(lastStateData);
			this.accumulateStateDataProps(accumulatedDataProps, newStateDatas[n]);
			state.data = extend(true, state.data, newStateDatas[n]);
		}
		this.removeNonInheritedPropNames(state.data, lastStateData);
		for(let n = this.currentConfigs.length - 1; n >= prefixLength; n--) {
			const oldConfig = this.currentConfigs[n];
			if(oldConfig.teardownCallback) {
				oldConfig.teardownCallback(this.currentStateDatas[n]);
			}
		}
		this.insertAccumulatedStateDataProps(state.data, accumulatedDataProps);
		if(extraStateData) {
			state.data = extend(true, state.data, extraStateData);
		}
		this.currentState = state;
		this.currentStateDatas = newStateDatas;
		this.currentConfigs = newConfigs;
	}

	private findCommonStatePrefix(newConfigs: RouterConfig<{}, {}, {}>[]): number {
		const maxLength = Math.max(newConfigs.length, this.currentConfigs.length);
		let length = 0;
		while(length < maxLength) {
			if(newConfigs[length] !== this.currentConfigs[length]) {
				return length;
			}
			length++;
		}
		return length;
	}

	private removeNonInheritedPropNames(data: RouterStateData, lastData: RouterStateData | undefined): void {
		if(lastData) {
			for(let n = 0; n < this.nonInheritedPropNames.length; n++) {
				if(!lastData.hasOwnProperty(this.nonInheritedPropNames[n])) {
					delete data[this.nonInheritedPropNames[n]];
				}
			}
		}
	}

	private prepareAccumulatedPropNames(): RouterAccumulatedPropMap {
		let result: RouterAccumulatedPropMap = {};
		if(this.accumulatedPropNames) {
			for(let n = 0; n < this.accumulatedPropNames.length; n++) {
				result[this.accumulatedPropNames[n]] = [];
			}
		}
		return result;
	}

	private accumulateStateDataProps(accumulatedDataProps: RouterAccumulatedPropMap, data: RouterStateData) {
		for(let name in data) {
			if(!data.hasOwnProperty(name)) {
				continue;
			}
			let values = accumulatedDataProps[name];
			if((name && (name.charAt(0) === '+')) || (values !== undefined)) {
				if(!values) {
					values = [];
				}
				const value = data[name];
				if(Array.isArray(value)) {
					values = values.concat(value);
				} else {
					values.push(value);
				}
				accumulatedDataProps[name] = values;
			}
		}
	}

	private insertAccumulatedStateDataProps(data: RouterStateData, accumulatedDataProps: RouterAccumulatedPropMap) {
		for(let name in accumulatedDataProps) {
			if(!accumulatedDataProps.hasOwnProperty(name)) {
				continue;
			}
			if(name.charAt(0) === '+') {
				data[name.substring(1)] = accumulatedDataProps[name];
			} else {
				data[name] = accumulatedDataProps[name];
			}
		}
	}

	private logError(error: any) {
		if(console && console.error) {
			console.error(error);
		}
	}

}
