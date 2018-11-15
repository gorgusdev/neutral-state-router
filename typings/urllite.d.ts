/**
 * Created by gorgus on 2015-01-07.
 */

declare module "urllite" {

	interface UrlLiteResult {
		origin: string;
		protocol: string;
		username: string;
		password: string;
		host: string;
		hostname: string;
		port: string;
		pathname: string;
		search: string;
		hash: string;
		resolve(url: string): UrlLiteResult;
		relativize(url: string): UrlLiteResult;
	}
	
    function urllite(url: string): UrlLiteResult;

	namespace urllite {}
    export = urllite;

}
