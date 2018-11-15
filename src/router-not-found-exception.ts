// Copyright (c) 2018 Göran Gustafsson. All rights reserved.
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

import { RouterException } from './router-exception';
import { RouterConfig, RouterUrlParams, RouterQueryParams, RouterStateData } from './router-types';

export class RouterNotFoundException<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> extends RouterException {

    public matched: RouterConfig<UP, QP, SD, CX>[] | undefined;

    constructor(message: string, matched: RouterConfig<UP, QP, SD, CX>[] | undefined) {
        super(message);
        this.matched = matched;
    }

}
