import 'es6-promise';

import router, { RouterBrowserHistory, RouterConfigMap } from '../src/index';

router.addConfig<{}, {}, {}>('t', {
	configs: {},
	data: {
		'a': 'b'
	}
});

router.addConfig<{}, {}, {}>('a', {
	url: '/',
	data: {
		level: 'first'
	},
	errorPath: 'app.error',
	configs: {
		error: {
			data: {
				error: true
			}
		},
		b1: {
			url: '/b1',
			data: {
				level: 'second',
				'+acc': 'b1acc'
			},
			unrouted: true,
			configs: {
				c1: {
					url: '/c1',
					reloadable: true,
					data: {
						level: 'third',
						'+acc': 'c1acc'
					}
				},
				c2: {
					url: '/c2',
					data: {
						level: 'third',
						'+acc': ['c2acc1', 'c2acc2']
					}
				},
				c3: {
					data: {
						level: 'third',
						'+acc': [['c3acc']]
					},
				},
				c4: {
					url: '/c4/:arg1',
					data: {
						level: 'third'
					}
				},
				c5: {
					url: '^/c5'
				}
			}
		},
		b2: {
			url: '/b2',
			unrouted: true,
			data: {
				level: 'second'
			},
			routeExtensionCallback: function(): Promise<RouterConfigMap<{}, {}, {}>> {
				console.log('Extend!');
				return new Promise<RouterConfigMap<{}, {}, {}>>((resolve, reject) => {
					setTimeout(() => {
						resolve({
							c1: {
								url: '/c1',
								data: {
									level: 'third'
								}
							}
						});
					}, 5000);
				});
			}
		},
		b3: {
			configs: {
				c1: {
					url: '/b3c1'
				}
			}
		}
	}
});

let msgElem: any = document.getElementById('content');
let msgProp = ('innerText' in msgElem) ? 'innerText' : 'textContent';
let hist: any = new RouterBrowserHistory('', true, !!(<any>window).useIFrameState, 'historyState');
router.start(hist, (state) => {
	console.log('Found State');
	console.log(state);
	msgElem[msgProp] = JSON.stringify(state);
	document.title = 'Test ' + state.historyTrackId;
}, (path, url, partialState, error) => {
	console.log('NotFound: ' + path + ', ' + url, error);
	msgElem[msgProp] = 'NOT FOUND: ' + JSON.stringify(partialState);
}, () => {
	console.log('Missing URL route path');
	router.navigateTo('app', {}, {});
	msgElem[msgProp] = 'MISSING';
}, (transitionId) => {
	console.log('Transition Begin: ' + transitionId);
}, (transitionId) => {
	console.log('Transition Cancel: ' + transitionId);
}, (transitionId) => {
	console.log('Transition End: ' + transitionId);
});

console.log('Url for a.b1.c4 = ', router.getConfigUrl('a.b1.c4', { arg1: 'testArg' }));

let elem = document.getElementById('b1c1');
if(elem && elem.addEventListener) {
	elem.addEventListener('click', (event) => {
		event.preventDefault();
		router.navigateTo('a.b1.c1', {}, {});
	});
} else {
	(<any>elem).attachEvent('onclick', (event: any) => {
		event.returnValue = false;
		router.navigateTo('a.b1.c1', {}, {});
		return false;
	});
}

elem = document.getElementById('b1c2');
if(elem && elem.addEventListener) {
	elem.addEventListener('click', (event) => {
		event.preventDefault();
		router.navigateTo('a.b1.c2', {}, { hello: 'world' });
	});
} else {
	(<any>elem).attachEvent('onclick', (event: any) => {
		event.returnValue = false;
		router.navigateTo('a.b1.c2', {}, { hello: 'world' });
		return false;
	});
}

elem = document.getElementById('b1c3');
if(elem && elem.addEventListener) {
	elem.addEventListener('click', (event) => {
		event.preventDefault();
		router.navigateTo('a.b1.c3', {}, {});
	});
} else {
	(<any>elem).attachEvent('onclick', (event: any) => {
		event.returnValue = false;
		router.navigateTo('a.b1.c3', {}, {});
		return false;
	});
}

elem = document.getElementById('b1c4');
if(elem && elem.addEventListener) {
	elem.addEventListener('click', (event) => {
		event.preventDefault();
		router.navigateTo('a.b1.c4', { arg1: 'xyz' }, {});
	});
} else {
	(<any>elem).attachEvent('onclick', (event: any) => {
		event.returnValue = false;
		router.navigateTo('a.b1.c4', { arg1: 'xyz' }, {});
		return false;
	});
}

elem = document.getElementById('b2c1');
if(elem && elem.addEventListener) {
	elem.addEventListener('click', (event) => {
		event.preventDefault();
		router.navigateTo('a.b2.c1', {}, {});
	});
} else {
	(<any>elem).attachEvent('onclick', (event: any) => {
		event.returnValue = false;
		router.navigateTo('a.b2.c1', {}, {});
		return false;
	});
}

elem = document.getElementById('reqReload');
if(elem && elem.addEventListener) {
	elem.addEventListener('click', (event) => {
		event.preventDefault();
		router.requestReload();
	});
} else {
	(<any>elem).attachEvent('onclick', (event: any) => {
		event.returnValue = false;
		router.requestReload();
		return false;
	});
}
