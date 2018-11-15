// Copyright (c) 2018 Göran Gustafsson. All rights reserved.
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

import { RouterException } from './router-exception';

export class RouterCancelledException extends RouterException {

    constructor() {
        super('Cancelled');
    }

}
