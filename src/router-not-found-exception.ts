// Copyright (c) 2016 Göran Gustafsson. All rights reserved.  
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

import { RouterException } from './router-exception';
import { RouterConfig } from './router-types';

export class RouterNotFoundException<UP, QP, SD> extends RouterException {

	public matched: RouterConfig<UP, QP, SD>[] | undefined;

	constructor(message: string, matched: RouterConfig<UP, QP, SD>[] | undefined) {
		super(message);
		this.matched = matched;
	}

}
