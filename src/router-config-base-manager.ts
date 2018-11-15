// Copyright (c) 2018 Göran Gustafsson. All rights reserved.
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

import extend from 'extend';
import { RouterUrlParams, RouterQueryParams, RouterStateData } from './router-types';
import { RouterConfig } from './router-types';

export abstract class RouterConfigBaseManager<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {

    protected root: RouterConfig<UP, QP, SD, CX>;

    constructor() {
        this.root = {
            unrouted: true,
            configs: {}
        };
    }

    protected internalAddConfig(configPathParts: string[], config: RouterConfig<UP, QP, SD, CX>): void {
        let parentConfig: RouterConfig<UP, QP, SD, CX> = this.root;
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
    }

}
