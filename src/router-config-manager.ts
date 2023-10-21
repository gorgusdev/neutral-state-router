// Copyright (c) 2018 Göran Gustafsson. All rights reserved.
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

import extend from 'extend';
import * as pathToRegexp from 'path-to-regexp';
import queryString from 'query-string';
import { RouterUrlParams, RouterQueryParams, RouterStateData } from './router-types';
import { RouterConfig } from './router-types';
import { RouterException } from './router-exception';
import { RouterNotFoundException } from './router-not-found-exception';
import { RouterConfigBaseManager } from './router-config-base-manager';

export interface RouterConfigMatch<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    configPath: string;
    pathMatches: RegExpExecArray;
    configMatches: RouterConfig<UP, QP, SD, CX>[];
    prefixMatch: boolean;
}

export type RouterPossibleConfigMatch<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> =
    RouterConfigMatch<UP, QP, SD, CX> | undefined;
export type RouterPossibleConfigs<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> =
    RouterConfig<UP, QP, SD, CX>[] | undefined;

interface RouterConfigInternal<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> extends RouterConfig<UP, QP, SD, CX> {
    routeExtensionPromise?: Promise<RouterConfig<UP, QP, SD, CX>>;
    routeExtended?: boolean;
    pathPrefixRegExp?: RegExp;
    pathPrefixParams?: pathToRegexp.Key[];
    pathRegExp?: RegExp;
    pathBuildFunc?: (params: any) => string;
    pathParams?: pathToRegexp.Key[];
    rootSubUrl?: boolean;
}

export class RouterConfigManager<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX>
    extends RouterConfigBaseManager<UP, QP, SD, CX> {

    constructor() {
        super();
        this.buildRouterConfigUrlPrefix(this.root, '', true, false);
    }

    public addConfig(configPath: string, config: RouterConfig<UP, QP, SD, CX>, running: boolean): void {
        const configPathParts: string[] = configPath.split('.');
        this.internalAddConfig(configPathParts, config);
        if(running) {
            this.buildRouterConfigs();
        }
    }

    public getConfigUrl(configPath: string, urlParams?: UP, queryParams?: QP): string | undefined {
        const configPathParts: string[] = configPath.split('.');
        let configs: RouterConfig<UP, QP, SD, CX>[] = [];
        let currentConfig: RouterConfigInternal<UP, QP, SD, CX> | undefined;
        let parentConfig = this.root;
        for(const configPathPart of configPathParts) {
            const parentConfigs = parentConfig.configs || {};
            currentConfig = parentConfigs[configPathPart];
            if(currentConfig) {
                configs = configs.concat([currentConfig]);
                parentConfig = currentConfig;
            } else {
                return undefined;
            }
        }
        return this.buildConfigStateUrl(configs, urlParams || {} as UP, queryParams || {} as QP);
    }

    public findRouterConfigByName(
        configPathParts: string[],
        context: CX | undefined
    ): Promise<RouterConfig<UP, QP, SD, CX>[]> {
        return this.internalFindRouterConfigByName(configPathParts, 0, this.root, [], context);
    }

    protected internalFindRouterConfigByName(
        configPathParts: string[],
        startRouteNameIndex: number,
        parentConfig: RouterConfigInternal<UP, QP, SD, CX>,
        configs: RouterConfig<UP, QP, SD, CX>[],
        context: CX | undefined
    ): Promise<RouterConfig<UP, QP, SD, CX>[]> {
        return new Promise<RouterConfig<UP, QP, SD, CX>[]>((resolve, reject) => {
            let currentConfig: RouterConfigInternal<UP, QP, SD, CX> | undefined;
            for(let n = startRouteNameIndex; n < configPathParts.length; n++) {
                const configPathPart = configPathParts[n];
                const parentConfigs = parentConfig.configs || {};
                currentConfig = parentConfigs[configPathPart];
                if(currentConfig) {
                    configs = configs.concat([currentConfig]);
                    parentConfig = currentConfig;
                } else {
                    if(parentConfig.routeExtensionCallback && !parentConfig.routeExtended) {
                        this.extendRouterConfig(configPathParts, parentConfig, context).then((config) => {
                            resolve(this.internalFindRouterConfigByName(configPathParts, n, config, configs, context));
                        }).catch((error: Error) => {
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

    public findRoutedConfigByUrl(
        url: string,
        context: CX | undefined
    ): Promise<RouterPossibleConfigMatch<UP, QP, SD, CX>> {
        return this.internalFindRoutedConfigByUrl(this.root, [], url, [], context);
    }

    protected internalFindRoutedConfigByUrl(
        config: RouterConfigInternal<UP, QP, SD, CX>,
        configPath: string[],
        url: string,
        configs: RouterConfig<UP, QP, SD, CX>[],
        context: CX | undefined
    ): Promise<RouterPossibleConfigMatch<UP, QP, SD, CX>> {
        return new Promise<RouterPossibleConfigMatch<UP, QP, SD, CX>>((resolve, reject) => {
            const pathPrefixRegExp = config.pathPrefixRegExp;
            let subConfigs: RouterConfig<UP, QP, SD, CX>[] | undefined;
            if(pathPrefixRegExp || config.rootSubUrl) {
                let pathPrefixParams: RegExpExecArray | null = null;
                if(pathPrefixRegExp) {
                    pathPrefixParams = pathPrefixRegExp.exec(url);
                }
                if(pathPrefixParams || config.rootSubUrl) {
                    if(config.routeExtensionCallback && !config.routeExtended) {
                        this.extendRouterConfig(configPath, config, context).then((extConfig) => {
                            resolve(this.internalFindRoutedConfigByUrl(extConfig, configPath, url, configs, context));
                        }).catch((error: Error) => {
                            reject(error);
                        });
                        return;
                    }
                    subConfigs = configs.concat([config]);
                    const subCalls: PromiseLike<RouterPossibleConfigMatch<UP, QP, SD, CX>>[] = [];
                    const configConfigs = config.configs || {};
                    for(const key in configConfigs) {
                        if(!configConfigs.hasOwnProperty(key)) {
                            continue;
                        }
                        const subConfig = configConfigs[key];
                        subCalls.push(this.internalFindRoutedConfigByUrl(subConfig, configPath.concat([key]), url, subConfigs, context));
                    }
                    if(subCalls.length > 0) {
                        Promise.all<RouterPossibleConfigMatch<UP, QP, SD, CX>>(subCalls).then((subMatches: RouterPossibleConfigMatch<UP, QP, SD, CX>[]) => {
                            let bestMatch: RouterPossibleConfigMatch<UP, QP, SD, CX>;
                            for(const subMatch of subMatches) {
                                if(subMatch) {
                                    if(!bestMatch
                                        || (!subMatch.prefixMatch
                                            && bestMatch.prefixMatch)
                                        || (subMatch.configMatches
                                            && (!bestMatch.configMatches
                                                || ((subMatch.prefixMatch === bestMatch.prefixMatch)
                                                    && (subMatch.configMatches.length > bestMatch.configMatches.length))))
                                    ) {
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
                        }).catch((reason) => {
                            reject(reason);
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

    protected matchRoutedConfigToUrl(
        config: RouterConfigInternal<UP, QP, SD, CX>,
        configPath: string[],
        url: string,
        configs: RouterConfig<UP, QP, SD, CX>[],
        pathPrefixParams: RegExpExecArray | null
    ): RouterPossibleConfigMatch<UP, QP, SD, CX> {
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

    protected extendRouterConfig(
        configPath: string[],
        config: RouterConfigInternal<UP, QP, SD, CX>,
        context: CX | undefined
    ): Promise<RouterConfig<UP, QP, SD, CX>> {
        if(!config.routeExtensionPromise) {
            config.routeExtensionPromise = new Promise((resolve, reject) => {
                if(!config.routeExtensionCallback) {
                    reject(new Error(''));
                } else {
                    const routeExtension = config.routeExtensionCallback(configPath.join('.'), config, context);
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
                    }).catch((error: Error) => {
                        config.routeExtensionPromise = undefined;
                        reject(error);
                    });
                }
            });
        }
        return config.routeExtensionPromise;
    }

    public buildRouterConfigs(): void {
        this.buildRouterMappingForConfig(this.root, '');
    }

    protected buildRouterMappingForConfig(config: RouterConfigInternal<UP, QP, SD, CX>, urlPrefix: string): boolean[] {
        const url = this.buildConfigUrl(urlPrefix, config.url);
        config.configs = config.configs || {};
        let hasRootConfigUrl = false;
        let hasRoutedSubConfig = !!config.routeExtensionCallback && !config.routeExtended;
        for(const key in config.configs) {
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

    protected buildConfigUrl(urlPrefix: string, configUrl: string | undefined): string {
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

    protected hasRootConfigUrl(configUrl: string | undefined): boolean {
        return !!configUrl && (configUrl.charAt(0) === '^');
    }

    protected buildRoutedConfigUrlMapping(config: RouterConfigInternal<UP, QP, SD, CX>, url: string): boolean {
        if(config.url && !config.unrouted) {
            const pathTokens = pathToRegexp.parse(url);
            config.pathRegExp = pathToRegexp.tokensToRegexp(pathTokens, undefined, {});
            config.pathBuildFunc = pathToRegexp.tokensToFunction(pathTokens);
            config.pathParams = [];
            for(const pathToken of pathTokens) {
                if(typeof pathToken !== 'string') {
                    config.pathParams.push(pathToken);
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

    protected buildRouterConfigUrlPrefix(config: RouterConfigInternal<UP, QP, SD, CX>, url: string, hasRoutedSubConfig: boolean, hasRootConfigUrl: boolean): void {
        if(hasRoutedSubConfig) {
            const pathParams: pathToRegexp.Key[] = [];
            if(url === '/') {
                url = url + '(.*)';
            } else {
                url = url + '/(.*)';
            }
            config.pathPrefixRegExp = pathToRegexp.pathToRegexp(url, pathParams);
            config.pathPrefixParams = pathParams;
        } else {
            delete config.pathPrefixRegExp;
            delete config.pathPrefixParams;
        }
        config.rootSubUrl = hasRootConfigUrl;
    }

    public buildConfigStateUrl(configs: RouterConfigInternal<UP, QP, SD, CX>[], urlParams: UP, queryParams: QP): string {
        for(let n = configs.length - 1; n >= 0; n--) {
            const config = configs[n];
            if(config.pathBuildFunc) {
                let url = config.pathBuildFunc(urlParams);
                const params: { [key: string]: (string | number | boolean) | (string | number | boolean)[] | null | undefined } = {};
                for(const key in queryParams) {
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

    public findAndBuildUrlParams(url: string, configs: RouterConfigInternal<UP, QP, SD, CX>[]): UP {
        if(!url || !configs) {
            return {} as UP;
        }
        for(let n = configs.length - 1; n >= 0; n--) {
            const config: RouterConfigInternal<UP, QP, SD, CX> = configs[n];
            if(config.pathRegExp) {
                const pathMatches = config.pathRegExp.exec(url);
                if(pathMatches) {
                    return this.internalBuildUrlParams(config.pathParams, pathMatches);
                }
            }
            if(config.pathPrefixRegExp) {
                const pathMatches = config.pathPrefixRegExp.exec(url);
                if(pathMatches) {
                    return this.internalBuildUrlParams(config.pathPrefixParams, pathMatches);
                }
            }
        }
        return {} as UP;
    }

    public buildUrlParams(config: RouterConfig<UP, QP, SD, CX>, pathMatches: RegExpExecArray): UP {
        return this.internalBuildUrlParams((config as RouterConfigInternal<UP, QP, SD, CX>).pathParams, pathMatches);
    }

    protected internalBuildUrlParams(pathParams: pathToRegexp.Key[] | undefined, pathMatches: RegExpExecArray): UP {
        const urlParams: RouterUrlParams = {};
        if(pathParams) {
            for(let n = 0; (n < pathParams.length) && (n + 1 < pathMatches.length); n++) {
                const paramName = '' + pathParams[n].name;
                urlParams[paramName] = pathMatches[n + 1];
            }
        }
        return urlParams as UP;
    }

    public findErrorPathInMatch(configMatch: RouterConfigMatch<UP, QP, SD, CX>): string | undefined {
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

}
