import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { RouterConfigManager } from './router-config-manager';
import { RouterNotFoundException } from './router-not-found-exception';

chai.use(chaiAsPromised);

describe('router-config-manager', function() {
    describe('addConfig', function() {
        it('should add a root config', function() {
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', {
                url: '/'
            }, true);
            expect((configManager as any).root.configs.a.url).to.equal('/');
        });

        it('should add a sub config', function() {
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', {
                url: '/a'
            }, true);
            configManager.addConfig('a.b', {
                url: '/b'
            }, true);
            expect((configManager as any).root.configs.a.url).to.equal('/a');
            expect((configManager as any).root.configs.a.configs.b.url).to.equal('/b');
        });

        it('should rebuild internal config data if router is running', function() {
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', {
                url: '/a'
            }, true);
            expect((configManager as any).root.configs.a.pathRegExp).to.not.be.undefined;
        });

        it('should not rebuild internal config data if router is not running', function() {
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', {
                url: '/a'
            }, false);
            expect((configManager as any).root.configs.a.pathRegExp).to.be.undefined;
        });

        it('should add an initial slash to the URL regexp', function() {
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', {
                url: 'a'
            }, true);
            expect((configManager as any).root.configs.a.pathRegExp.test('/a')).to.equal(true);
        })

        it('should ensure an initial slash in the URL regexp when root URL is only a slash', function() {
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', {
                url: '/',
                configs: {
                    b: {
                        url: 'b'
                    },
                    c: {
                        url: '/c'
                    }
                }
            }, true);
            expect((configManager as any).root.configs.a.configs.b.pathRegExp.test('/b')).to.equal(true);
            expect((configManager as any).root.configs.a.configs.c.pathRegExp.test('/c')).to.equal(true);
        })

        it('should ensure an initial slash in the URL regexp if using a rooted URL', function() {
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', {
                url: '/a',
                configs: {
                    b: {
                        url: '^b'
                    },
                    c: {
                        url: '^/c'
                    }
                }
            }, true);
            expect((configManager as any).root.configs.a.configs.b.pathRegExp.test('/b')).to.equal(true);
            expect((configManager as any).root.configs.a.configs.c.pathRegExp.test('/c')).to.equal(true);
        })
    });

    describe('getConfigUrl', function() {
        it('should return the url for the last config', function() {
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', {
                url: '/a',
                configs: {
                    b: {
                        url: '/b'
                    }
                }
            }, true);
            expect(configManager.getConfigUrl('a.b')).to.equal('/a/b');
        });
        it('should return undefined for missing config', function() {
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', {
                url: '/a',
                configs: {
                    b: {
                        url: '/b'
                    }
                }
            }, true);
            expect(configManager.getConfigUrl('a.c')).to.equal(undefined);
        });
    });
    
    describe('findRouterConfigByName', function() {
        it('should resolve a promise to an array of configs matching an array of names', function() {
            var config = {
                url: '/a',
                configs: {
                    b: {
                        url: '/b'
                    },
                    c: {
                        url: '/c'
                    }
                }
            };
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', config, true);
            return expect(configManager.findRouterConfigByName(['a', 'c'], undefined).then(function(configs) {
                return configs.map(function (config) {
                    return config.url;
                });
            })).to.eventually.deep.equal(['/a', '/c']);
        });

        it('should reject a promise with a RouterNotFoundException when an array of names doesn\'t match', function() {
            var config = {
                url: '/a',
                configs: {
                    b: {
                        url: '/b'
                    },
                    c: {
                        url: '/c'
                    }
                }
            };
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', config, true);
            return expect(configManager.findRouterConfigByName(['a', 'd'], undefined).then(function(configs) {
                return configs.map(function (config) {
                    return config.url;
                });
            })).to.eventually.be.rejectedWith('Unable to find router config for path');
        });

        it('should extend the config with the extend config callback', function() {
            var config = {
                url: '/a',
                routeExtensionCallback: function() {
                    return Promise.resolve({
                        d: {
                            url: '/d'
                        }
                    });
                },
                configs: {
                    b: {
                        url: '/b'
                    },
                    c: {
                        url: '/c'
                    }
                }
            };
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', config, true);
            return expect(configManager.findRouterConfigByName(['a', 'd'], undefined).then(function(configs) {
                return configs.map(function (config) {
                    return config.url;
                });
            })).to.eventually.deep.equal(['/a', '/d']);
        });

        it('should reject if extend callback returns a promise that rejects', function() {
            var config = {
                url: '/a',
                routeExtensionCallback: function() {
                    return Promise.reject(new Error('test'));
                },
                configs: {
                    b: {
                        url: '/b'
                    },
                    c: {
                        url: '/c'
                    }
                }
            };
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', config, true);
            return expect(configManager.findRouterConfigByName(['a', 'd'], undefined).then(function(configs) {
                return configs.map(function (config) {
                    return config.url;
                });
            })).to.eventually.be.rejectedWith('test');
        });
        it('should reject if extend callback throws', function() {
            var config = {
                url: '/a',
                routeExtensionCallback: function() {
                    throw new Error('thrown');
                },
                configs: {
                    b: {
                        url: '/b'
                    },
                    c: {
                        url: '/c'
                    }
                }
            };
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', config, true);
            return expect(configManager.findRouterConfigByName(['a', 'd'], undefined).then(function(configs) {
                return configs.map(function (config) {
                    return config.url;
                });
            })).to.eventually.be.rejectedWith('thrown');
        });
        it('should reject if extend callback returns undefined', function() {
            var config = {
                url: '/a',
                routeExtensionCallback: function() {
                    return Promise.resolve(undefined);
                },
                configs: {
                    b: {
                        url: '/b'
                    },
                    c: {
                        url: '/c'
                    }
                }
            };
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', config as any, true);
            return expect(configManager.findRouterConfigByName(['a', 'd'], undefined).then(function(configs) {
                return configs.map(function (config) {
                    return config.url;
                });
            })).to.eventually.be.rejectedWith('did not return a config');
        });
    });
    describe('findRoutedConfigByUrl', function() {
        it('should resolve a promise to an array of configs matching an URL', function() {
            var config = {
                url: '/a',
                configs: {
                    b: {
                        url: '/b'
                    },
                    c: {
                        url: '/c'
                    }
                }
            };
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', config, true);
            return expect(configManager.findRoutedConfigByUrl('/a/c', undefined).then(function(configMatch) {
                return configMatch && configMatch.configMatches && configMatch.configMatches.map(function (config) {
                    return config.url;
                }).concat([`${configMatch.prefixMatch}`]);
            })).to.eventually.deep.equal(['/a', '/c', 'false']);
        });

        it('should resolve a promise to an array of configs matching an rooted URL', function() {
            var config = {
                url: '/a',
                configs: {
                    b: {
                        url: '/b'
                    },
                    c: {
                        url: '^/c'
                    }
                }
            };
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', config, true);
            return expect(configManager.findRoutedConfigByUrl('/c', undefined).then(function(configMatch) {
                return configMatch && configMatch.configMatches && configMatch.configMatches.map(function (config) {
                    return config.url;
                }).concat([`${configMatch.prefixMatch}`]);
            })).to.eventually.deep.equal(['/a', '^/c', 'false']);
        });

        it('should resolve with undefined when an URL doesn\'t match at all', function() {
            var config = {
                url: '/a',
                configs: {
                    b: {
                        url: '/b'
                    },
                    c: {
                        url: '/c'
                    }
                }
            };
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', config, true);
            return expect(configManager.findRoutedConfigByUrl('b', undefined)).to.eventually.equal(undefined);
        });

        it('should resolve with a prefix match when only a prefix part of an URL match', function() {
            var config = {
                url: '/a',
                configs: {
                    b: {
                        url: '/b'
                    },
                    c: {
                        url: '/c'
                    }
                }
            };
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', config, true);
            return expect(configManager.findRoutedConfigByUrl('/a/d', undefined).then(function(configMatch) {
                return configMatch && configMatch.configMatches && configMatch.configMatches.map(function (config) {
                    return config.url;
                }).concat([`${configMatch.prefixMatch}`]);
            })).to.eventually.deep.equal(['/a', 'true']);
        });

        it('should extend the config with the extend config callback', function() {
            var config = {
                url: '/a',
                routeExtensionCallback: function() {
                    return Promise.resolve({
                        d: {
                            url: '/d'
                        }
                    });
                },
                configs: {
                    b: {
                        url: '/b'
                    },
                    c: {
                        url: '/c'
                    }
                }
            };
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', config, true);
            return expect(configManager.findRoutedConfigByUrl('/a/d', undefined).then(function(configMatch) {
                return configMatch && configMatch.configMatches && configMatch.configMatches.map(function (config) {
                    return config.url;
                });
            })).to.eventually.deep.equal(['/a', '/d']);
        });

        it('should reject if extend callback returns a promise that rejects', function() {
            var config = {
                url: '/a',
                routeExtensionCallback: function() {
                    return Promise.reject(new Error('test'));
                },
                configs: {
                    b: {
                        url: '/b'
                    },
                    c: {
                        url: '/c'
                    }
                }
            };
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', config, true);
            return expect(configManager.findRoutedConfigByUrl('/a/d', undefined)).to.eventually.be.rejectedWith('test');
        });

        it('should reject if extend callback throws', function() {
            var config = {
                url: '/a',
                routeExtensionCallback: function() {
                    throw new Error('thrown');
                },
                configs: {
                    b: {
                        url: '/b'
                    },
                    c: {
                        url: '/c'
                    }
                }
            };
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', config, true);
            return expect(configManager.findRoutedConfigByUrl('/a/d', undefined)).to.eventually.be.rejectedWith('thrown');
        });

        it('should reject if extend callback returns undefined', function() {
            var config = {
                url: '/a',
                routeExtensionCallback: function() {
                    return Promise.resolve(undefined);
                },
                configs: {
                    b: {
                        url: '/b'
                    },
                    c: {
                        url: '/c'
                    }
                }
            };
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', config as any, true);
            return expect(configManager.findRoutedConfigByUrl('/a/d', undefined)).to.eventually.be.rejectedWith('did not return a config');
        });
    });

    describe('buildConfigStateUrl', function() {
        it('should insert path parameters in URL for configs', function() {
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', {
                url: '/a/:param'
            }, true);
            expect(configManager.buildConfigStateUrl([(configManager as any).root.configs.a], { param: 'Test' }, {})).to.equal('/a/Test');
        });

        it('should add query parameters on URL for configs', function() {
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', {
                url: '/a/:param'
            }, true);
            expect(configManager.buildConfigStateUrl([(configManager as any).root.configs.a], { param: 'Test' }, { test: '123' })).to.equal('/a/Test?test=123');
        });

        it('should return a single slash if no configs are provided', function() {
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', {
                url: '/a/:param'
            }, true);
            expect(configManager.buildConfigStateUrl([], {}, {})).to.equal('/');
        });
    });

    describe('findAndBuildUrlParams', function() {
        it('should extract path params from URL', function() {
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', {
                url: '/a/:param'
            }, true);
            expect(configManager.findAndBuildUrlParams('/a/Test', [(configManager as any).root.configs.a])).to.deep.equal({ param: 'Test' });
        });

        it('should extract path params from prefix URL', function() {
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', {
                url: '/a/:param',
                configs: {
                    b: {
                        url: '/b'
                    }
                }
            }, true);
            expect(configManager.findAndBuildUrlParams('/a/Test/b', [(configManager as any).root.configs.a])).to.deep.equal({ '0': 'b', param: 'Test' });
        });
    });

    describe('findErrorPathInMatch', function() {
        it('should find the error path in an array of configs', function() {
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', {
                url: '/a',
                errorPath: 'a.error',
                configs: {
                    b: {
                        url: '/b'
                    },
                    c: {
                        url: '/c'
                    }
                }
            }, true);
            expect(configManager.findErrorPathInMatch({ configMatches: [(configManager as any).root.configs.a, (configManager as any).root.configs.a.configs.b] } as any)).to.equal('a.error');
        });

        it('should find the last error path in an array of configs', function() {
            var configManager = new RouterConfigManager();
            configManager.addConfig('a', {
                url: '/a',
                errorPath: 'a.error',
                configs: {
                    b: {
                        url: '/b',
                        errorPath: 'b.error'
                    },
                    c: {
                        url: '/c'
                    }
                }
            }, true);
            expect(configManager.findErrorPathInMatch({ configMatches: [(configManager as any).root.configs.a, (configManager as any).root.configs.a.configs.b] } as any)).to.equal('b.error');
        });
    });
});
