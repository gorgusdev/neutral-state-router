/**
 * Created by gorgus on 2016-01-08.
 */
interface PathToRegExpKey {
    name: string;
    delimiter: string;
    repeat: boolean;
    optional: boolean;
	pattern?: string;
}

interface PathToRegExpOpts {
	sensitive?: boolean;
	strict?: boolean;
	end?: boolean;
}

declare module "path-to-regexp" {

	interface PathToRegexpFn {
		(path: string, keys: PathToRegExpKey[], options?: PathToRegExpOpts): RegExp;
		parse: (path: string) => Array<PathToRegExpKey|string>;
		compile: (path: string) => (params: any) => string;
		tokensToRegExp: (tokens: Array<PathToRegExpKey|string>, options: PathToRegExpOpts) => RegExp;
		tokensToFunction: (tokens: Array<PathToRegExpKey|string>) => (params: any) => string;
	}
	
    var pathToRegexp: PathToRegexpFn;
	
    export = pathToRegexp;

}