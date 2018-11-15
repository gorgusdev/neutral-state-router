// Copyright (c) 2018 Göran Gustafsson. All rights reserved.
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

import { RouterUrlParams, RouterQueryParams, RouterStateData } from './router-types';
import { RouterConfig, RouterConfigMap } from './router-types';
import { RouterConfigBaseManager } from './router-config-base-manager';
import { RouterException } from './router-exception';

export class RouterConfigExtensionManager<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX>
    extends RouterConfigBaseManager<UP, QP, SD, CX> {

    private baseConfigPathParts: string[];

    constructor(baseConfigPath: string = '') {
        super();
        if(baseConfigPath) {
            this.baseConfigPathParts = baseConfigPath.split('.');
        } else {
            this.baseConfigPathParts = [];
        }
    }

    public addConfig(configPath: string, config: RouterConfig<UP, QP, SD, CX>): void {
        const configPathParts: string[] = configPath.split('.');
        if(configPathParts.length <= this.baseConfigPathParts.length) {
            throw new RouterException('Extension config path must be longer than base config path: ' + configPath);
        }
        for(let n = 0; n < this.baseConfigPathParts.length; n++) {
            if(this.baseConfigPathParts[n] !== configPathParts[n]) {
                throw new RouterException('Extension config path must start with base config path: ' + configPath);
            }
        }
        configPathParts.splice(0, this.baseConfigPathParts.length);
        this.internalAddConfig(configPathParts, config);
    }

    public toExtensionCallbackResult(): RouterConfigMap<UP, QP, SD, CX> {
        return this.root.configs || {};
    }
}
