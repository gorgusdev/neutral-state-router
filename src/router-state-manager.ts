// Copyright (c) 2018 Göran Gustafsson. All rights reserved.
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

import extend from 'extend';
import { RouterUrlParams, RouterQueryParams, RouterStateData } from './router-types';
import { RouterConfig, RouterState } from './router-types';

interface RouterAccumulatedPropMap {
    [name: string]: any[];
}

export class RouterStateManager<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {

    private currentState: RouterState<UP, QP, SD>;
    private currentStateDatas: SD[];
    private currentConfigs: RouterConfig<UP, QP, SD, CX>[];

    private accumulatedPropNames: string[] = [];
    private nonInheritedPropNames: string[] = [];

    constructor() {
        this.currentState = {
            configPath: '',
            url: '',
            urlParams: {} as UP,
            queryParams: {} as QP,
            historyTrackId: undefined,
            transitionId: 0,
            data: {} as SD
        };
        this.currentStateDatas = [];
        this.currentConfigs = [];
    }

    public getCurrentState(): RouterState<UP, QP, SD> {
        return this.currentState;
    }

    public setAccumulatedStateDataPropNames(propNames: string[]): void {
        this.accumulatedPropNames = propNames;
    }

    public setNonInheritedStateDataPropNames(propNames: string[]): void {
        this.nonInheritedPropNames = propNames;
    }

    public updateState(
        configPath: string,
        url: string,
        urlParams: UP,
        queryParams: QP,
        historyTrackId: string | undefined,
        transitionId: number,
        newConfigs: RouterConfig<UP, QP, SD, CX>[],
        extraStateData: SD | undefined,
        context: CX | undefined
    ): RouterState<UP, QP, SD> {
        const state: RouterState<UP, QP, SD> = {
            configPath: configPath,
            url: url,
            urlParams: urlParams,
            queryParams: queryParams,
            historyTrackId: historyTrackId,
            transitionId: transitionId,
            data: {} as SD
        };
        const newStateDatas: SD[] = [];
        const accumulatedDataProps: RouterAccumulatedPropMap = this.prepareAccumulatedPropNames();
        const prefixLength = this.findCommonStatePrefix(newConfigs);
        let lastStateData: SD | undefined;
        for(let n = 0; n < prefixLength; n++) {
            const newConfig = newConfigs[n];
            if(newConfig.refreshCallback) {
                lastStateData = newConfig.refreshCallback(state, state.data, this.currentStateDatas[n], context);
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
                lastStateData = newConfig.setupCallback(state, state.data, extend<SD, SD>({} as SD, newConfig.data || {} as SD), context);
            } else {
                lastStateData = newConfig.data || {} as SD;
            }
            newStateDatas.push(lastStateData);
            this.accumulateStateDataProps(accumulatedDataProps, newStateDatas[n]);
            state.data = extend(true, state.data, newStateDatas[n]);
        }
        this.removeNonInheritedPropNames(state.data, lastStateData);
        for(let n = this.currentConfigs.length - 1; n >= prefixLength; n--) {
            const oldConfig = this.currentConfigs[n];
            if(oldConfig.teardownCallback) {
                oldConfig.teardownCallback(this.currentStateDatas[n], context);
            }
        }
        this.insertAccumulatedStateDataProps(state.data, accumulatedDataProps);
        if(extraStateData) {
            state.data = extend(true, state.data, extraStateData);
        }
        this.currentState = state;
        this.currentStateDatas = newStateDatas;
        this.currentConfigs = newConfigs;

        return state;
    }

    private findCommonStatePrefix(newConfigs: RouterConfig<UP, QP, SD, CX>[]): number {
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

    private removeNonInheritedPropNames(data: SD, lastData: SD | undefined): void {
        if(lastData) {
            for(const nonInheritedPropName of this.nonInheritedPropNames) {
                if(!lastData.hasOwnProperty(nonInheritedPropName)) {
                    delete data[nonInheritedPropName];
                }
            }
        }
    }

    private prepareAccumulatedPropNames(): RouterAccumulatedPropMap {
        const result: RouterAccumulatedPropMap = {};
        for(const accumulatedPropName of this.accumulatedPropNames) {
            result[accumulatedPropName] = [];
        }
        return result;
    }

    private accumulateStateDataProps(accumulatedDataProps: RouterAccumulatedPropMap, data: SD): void {
        for(const name in data) {
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

    private insertAccumulatedStateDataProps(data: SD, accumulatedDataProps: RouterAccumulatedPropMap): void {
        for(const name in accumulatedDataProps) {
            if(!accumulatedDataProps.hasOwnProperty(name)) {
                continue;
            }
            if(name.charAt(0) === '+') {
                data[name.substring(1)] = accumulatedDataProps[name];
                delete data[name];
            } else {
                data[name] = accumulatedDataProps[name];
            }
        }
    }

}
