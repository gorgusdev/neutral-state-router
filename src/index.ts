// Copyright (c) 2016 Göran Gustafsson. All rights reserved.  
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

import { Router } from './router';
export * from './router';
export * from './router-browser-history';
export * from './router-exception';
export * from './router-history';
export * from './router-memory-history';
export * from './router-not-found-exception';
export * from './router-types';

var router: Router = new Router();

export default router;
